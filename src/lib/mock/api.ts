import type { AdminDashboardStats, Driver, DriverLocation, EarningsSummary, FareEstimate, Payment, Trip, User } from "@/types";
import type { GoRideApi } from "@/lib/api/contract";
import { ACTIVE_TRIP_STATUSES, TERMINAL_TRIP_STATUSES } from "@/lib/constants";
import { generatePin, haversineKm, sleep, uid } from "@/lib/utils";
import { getRoute, isInsideServiceArea } from "@/lib/geo/providers";
import { estimateFor } from "./seed";
import { world } from "./world";

const LATENCY = Number(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS ?? 350);

function err(status: number, message: string, code?: string) {
  return Object.assign(new Error(message), { status, code });
}

async function delay(ms = LATENCY) {
  await sleep(ms + Math.random() * ms * 0.4);
}

const DEMO_PASSWORD = "goride123";

let currentUserId: string | null = null;
export function setMockCurrentUser(id: string | null) {
  currentUserId = id;
}

function fullTrip(t: Trip): Trip {
  const s = world().get();
  const payment = s.payments.find((p) => p.tripId === t.id) ?? t.payment ?? null;
  const driver = t.driverId ? s.drivers.find((d) => d.id === t.driverId) : null;
  const rider = s.users.find((u) => u.id === t.riderId);
  return {
    ...t,
    payment,
    driver: driver ? world().driverSummary(driver) : t.driver ?? null,
    rider: rider ? { id: rider.id, name: rider.name, phone: rider.phone ?? undefined, photoUrl: rider.profilePhotoUrl, rating: rider.rating } : t.rider ?? null,
  };
}

export const mockApi: GoRideApi = {
  /* ---------------------------------------------------------------- */
  auth: {
    async login(email, password) {
      await delay();
      const s = world().get();
      const user = s.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!user || (password !== DEMO_PASSWORD && password.length < 8)) throw err(401, "Incorrect email or password.", "INVALID_CREDENTIALS");
      if (user.deactivatedAt) throw err(403, "This account has been deactivated.", "ACCOUNT_DEACTIVATED");
      currentUserId = user.id;
      return { user, accessToken: `mock.${uid()}`, refreshToken: `mockrt.${uid()}`, expiresAt: Date.now() + 3600_000, provider: "mock" };
    },
    async register(payload) {
      await delay(500);
      const w = world();
      const s = w.get();
      if (s.users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) throw err(409, "An account with this email already exists.", "EMAIL_TAKEN");
      const user: User = {
        id: uid("usr"),
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        role: payload.role,
        profilePhotoUrl: null,
        emailVerified: false,
        phoneVerified: false,
        rating: 5,
        ratingCount: 0,
        createdAt: new Date().toISOString(),
      };
      w.commit("auth.register", (st) => {
        st.users.push(user);
        if (payload.role === "Driver") {
          const v = payload.vehicle!;
          const driver: Driver = {
            ...user,
            role: "Driver",
            profile: {
              driverId: user.id,
              vehicleMake: v.make,
              vehicleModel: v.model,
              vehiclePlate: v.plate,
              vehicleColor: v.color,
              vehicleTypeCode: v.typeCode,
              licenseNumber: v.licenseNumber,
              licenseExpiry: v.licenseExpiry,
              status: "PendingVerification",
              verifiedAt: null,
              online: false,
              documents: (["DrivingLicence", "VehicleRegistration", "Insurance", "NIC"] as const).map((kind, i) => ({ id: `${user.id}_doc_${i}`, kind, status: "Missing" })),
            },
          };
          st.drivers.push(driver);
          st.locations[user.id] = { driverId: user.id, lat: 6.9271, lng: 79.8612, heading: 0, status: "Offline", lastUpdated: new Date().toISOString() };
        }
        st.prefs.push({ userId: user.id, pushEnabled: true, smsEnabled: false, emailEnabled: true });
      });
      currentUserId = user.id;
      return { user, requiresVerification: true };
    },
    async requestOtp() {
      await delay();
    },
    async verifyOtp(email, code, purpose) {
      await delay();
      if (!/^\d{6}$/.test(code)) throw err(400, "Enter the 6-digit code.", "INVALID_OTP");
      if (code === "000000") throw err(400, "That code has expired or was already used.", "OTP_EXPIRED");
      if (purpose === "EmailVerify") {
        world().commit("auth.verifyEmail", (st) => {
          const u = st.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
          if (u) u.emailVerified = true;
          const d = st.drivers.find((x) => x.email.toLowerCase() === email.toLowerCase());
          if (d) d.emailVerified = true;
        });
      }
    },
    async me() {
      await delay(120);
      const s = world().get();
      const u = s.users.find((x) => x.id === currentUserId);
      if (!u) throw err(401, "Not signed in.");
      return u;
    },
    async logout() {
      await delay(120);
      currentUserId = null;
    },
  },

  /* ---------------------------------------------------------------- */
  users: {
    async get(id) {
      await delay(150);
      const s = world().get();
      const u = s.users.find((x) => x.id === id) ?? s.drivers.find((x) => x.id === id);
      if (!u) throw err(404, "User not found.");
      return u;
    },
    async update(id, patch) {
      await delay();
      let out: User | undefined;
      world().commit("user.update", (st) => {
        for (const list of [st.users, st.drivers] as User[][]) {
          const u = list.find((x) => x.id === id);
          if (u) {
            Object.assign(u, patch);
            out = u;
          }
        }
      });
      if (!out) throw err(404, "User not found.");
      return out;
    },
    async deactivate(id) {
      await delay();
      world().commit("user.deactivate", (st) => {
        const u = st.users.find((x) => x.id === id);
        if (u) u.deactivatedAt = new Date().toISOString();
      });
    },
    async listEmergencyContacts(userId) {
      await delay(150);
      return world().get().contacts.filter((c) => c.userId === userId);
    },
    async addEmergencyContact(userId, c) {
      await delay();
      const existing = world().get().contacts.filter((x) => x.userId === userId);
      if (existing.length >= 3) throw err(400, "You can add up to 3 emergency contacts.", "MAX_CONTACTS");
      const contact = { ...c, id: uid("ec"), userId };
      world().commit("contacts.add", (st) => st.contacts.push(contact));
      return contact;
    },
    async removeEmergencyContact(userId, contactId) {
      await delay();
      world().commit("contacts.remove", (st) => {
        st.contacts = st.contacts.filter((c) => !(c.userId === userId && c.id === contactId));
      });
    },
    async getNotificationPreferences(userId) {
      await delay(120);
      return world().get().prefs.find((p) => p.userId === userId) ?? { userId, pushEnabled: true, smsEnabled: false, emailEnabled: true };
    },
    async updateNotificationPreferences(userId, prefs) {
      await delay();
      let out = { userId, pushEnabled: true, smsEnabled: false, emailEnabled: true };
      world().commit("prefs.update", (st) => {
        const p = st.prefs.find((x) => x.userId === userId);
        if (p) {
          Object.assign(p, prefs);
          out = p;
        } else {
          out = { ...out, ...prefs };
          st.prefs.push(out);
        }
      });
      return out;
    },
    async listNotifications(userId) {
      await delay(150);
      return world()
        .get()
        .notifications.filter((n) => n.userId === userId)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    },
    async markNotificationRead(id) {
      world().commit("ntf.read", (st) => {
        const n = st.notifications.find((x) => x.id === id);
        if (n) n.read = true;
      });
    },
  },

  /* ---------------------------------------------------------------- */
  drivers: {
    async get(id) {
      await delay(150);
      return world().driver(id);
    },
    async updateVehicle(id, vehicle) {
      await delay();
      world().commit("driver.vehicle", (st) => {
        const d = st.drivers.find((x) => x.id === id);
        if (d) Object.assign(d.profile, vehicle);
      });
      return world().driver(id);
    },
    async uploadDocument(id, kind, fileName) {
      await delay(700);
      world().commit("driver.document", (st) => {
        const d = st.drivers.find((x) => x.id === id);
        if (!d) return;
        const doc = d.profile.documents.find((x) => x.kind === kind);
        if (doc) {
          doc.fileName = fileName;
          doc.uploadedAt = new Date().toISOString();
          doc.status = "Uploaded";
          doc.note = undefined;
        }
        if (d.profile.documents.every((x) => x.status === "Uploaded" || x.status === "Approved") && d.profile.status === "PendingVerification") {
          d.profile.status = "DocumentReview";
        }
      });
      return world().driver(id);
    },
    async setOnline(id, online) {
      await delay(200);
      const d = world().driver(id);
      if (d.profile.status !== "Active") throw err(403, "Your account must be verified and active before you can go online.", "DRIVER_NOT_ACTIVE");
      world().commit("driver.online", (st) => {
        const dr = st.drivers.find((x) => x.id === id)!;
        dr.profile.online = online;
        const loc = st.locations[id];
        if (loc) loc.status = online ? "Online" : "Offline";
        if (!online) delete st.presence[id];
      });
      return world().driver(id);
    },
    async list(filter) {
      await delay(200);
      let list = world().get().drivers;
      if (filter?.status) {
        const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
        list = list.filter((d) => arr.includes(d.profile.status));
      }
      if (filter?.query) {
        const q = filter.query.toLowerCase();
        list = list.filter((d) => d.name.toLowerCase().includes(q) || d.email.toLowerCase().includes(q) || d.profile.vehiclePlate.toLowerCase().includes(q));
      }
      return list;
    },
    async setStatus(id, action, reason) {
      await delay();
      if (!reason.trim()) throw err(400, "A reason is required for every admin action.", "REASON_REQUIRED");
      const admin = world().get().users.find((u) => u.id === currentUserId && u.role === "Admin");
      world().commit("driver.status", (st) => {
        const d = st.drivers.find((x) => x.id === id);
        if (!d) return;
        const map = { Approve: "Active", Reject: "Rejected", Suspend: "Suspended", Deactivate: "Deactivated", Reactivate: "Active" } as const;
        d.profile.status = map[action];
        if (action === "Approve") {
          d.profile.verifiedAt = new Date().toISOString();
          d.profile.documents.forEach((doc) => (doc.status = "Approved"));
        }
        if (action === "Reject") d.profile.documents.forEach((doc) => (doc.status = doc.status === "Uploaded" ? "Rejected" : doc.status));
        if (action !== "Approve" && action !== "Reactivate") {
          d.profile.online = false;
          const loc = st.locations[id];
          if (loc) loc.status = "Offline";
        }
        st.audit.unshift({
          id: uid("aud"),
          adminId: admin?.id ?? "usr_admin_01",
          adminName: admin?.name ?? "Admin",
          targetType: "Driver",
          targetId: d.id,
          targetName: d.name,
          action,
          reason,
          createdAt: new Date().toISOString(),
        });
        const msg = {
          Approve: "Your driver account has been approved. You can go online now.",
          Reject: `Your application was rejected: ${reason}`,
          Suspend: `Your account has been temporarily suspended: ${reason}`,
          Deactivate: `Your account has been deactivated: ${reason}`,
          Reactivate: "Your account has been reactivated. Welcome back!",
        }[action];
        world().notify(st, d.id, "Account update", msg, "driver.statusChanged");
      });
      return world().driver(id);
    },
  },

  /* ---------------------------------------------------------------- */
  location: {
    async updateDriverLocation(driverId, pos, heading, status) {
      world().commit("location.update", (st) => {
        st.locations[driverId] = { driverId, ...pos, heading, status, lastUpdated: new Date().toISOString() };
      });
    },
    async getDriverLocation(driverId) {
      return world().get().locations[driverId] ?? null;
    },
    async nearbyDrivers(pos, vehicleType, radiusKm = 4) {
      await delay(120);
      return world().nearby(pos, vehicleType, radiusKm);
    },
  },

  /* ---------------------------------------------------------------- */
  trips: {
    async vehicleTypes() {
      await delay(120);
      return world().get().vehicleTypes.filter((v) => v.active);
    },
    async updateVehicleType(id, patch, reason) {
      await delay();
      const admin = world().get().users.find((u) => u.id === currentUserId && u.role === "Admin");
      world().commit("vehicleType.update", (st) => {
        const vt = st.vehicleTypes.find((v) => v.id === id);
        if (!vt) return;
        Object.assign(vt, patch);
        st.audit.unshift({ id: uid("aud"), adminId: admin?.id ?? "usr_admin_01", adminName: admin?.name ?? "Admin", targetType: "Driver", targetId: vt.id, targetName: `Vehicle type ${vt.name}`, action: "UpdateRates", reason, createdAt: new Date().toISOString() });
      });
      return world().vehicleType(id);
    },
    async create(payload) {
      await delay();
      if (!isInsideServiceArea(payload.pickup)) throw err(422, "Pickup is outside our service area (Greater Colombo).", "OUT_OF_SERVICE_AREA");
      if (!isInsideServiceArea(payload.destination)) throw err(422, "Destination is outside our service area (Greater Colombo).", "OUT_OF_SERVICE_AREA");
      const pts = [payload.pickup, ...(payload.stops ?? []), payload.destination];
      const route = await getRoute(pts);
      const trip: Trip = {
        id: uid("trp"),
        riderId: payload.riderId,
        driverId: null,
        vehicleTypeId: "",
        vehicleTypeCode: "CAR",
        pickup: payload.pickup,
        destination: payload.destination,
        stops: (payload.stops ?? []).map((p, i) => ({ ...p, id: uid("stp"), sequence: i + 1 })),
        status: "RIDE_DRAFT",
        estimatedFare: null,
        finalFare: null,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        tripPin: null,
        matchRoundReached: 1,
        version: 0,
        createdAt: new Date().toISOString(),
        routeGeometry: route.geometry,
      };
      world().commit("trip.create", (st) => {
        // a rider only ever has one draft at a time
        st.trips = st.trips.filter((t) => !(t.riderId === payload.riderId && (t.status === "RIDE_DRAFT" || t.status === "FARE_ESTIMATED")));
        st.trips.push(trip);
      });
      return trip;
    },
    async updateStops(tripId, stops) {
      await delay();
      const t = world().trip(tripId);
      const route = await getRoute([t.pickup, ...stops, t.destination]);
      world().commit("trip.stops", (st) => {
        const tr = st.trips.find((x) => x.id === tripId)!;
        tr.stops = stops.map((p, i) => ({ ...p, id: uid("stp"), sequence: i + 1 }));
        tr.distanceKm = route.distanceKm;
        tr.durationMin = route.durationMin;
        tr.routeGeometry = route.geometry;
      });
      return world().trip(tripId);
    },
    async estimate(tripId) {
      await delay(250);
      const t = world().trip(tripId);
      const s = world().get();
      const out: FareEstimate[] = s.vehicleTypes
        .filter((v) => v.active)
        .map((v) => {
          const breakdown = estimateFor(v, t.distanceKm, t.durationMin, t.stops.length);
          const nearest = world()
            .nearby(t.pickup, v.code, 12)
            .map((l) => haversineKm(l, t.pickup))
            .sort((a, b) => a - b)[0];
          return {
            vehicleTypeId: v.id,
            vehicleTypeCode: v.code,
            estimatedFare: breakdown.total,
            distanceKm: t.distanceKm,
            durationMin: t.durationMin,
            etaMin: nearest != null ? Math.max(2, Math.round((nearest / 22) * 60) + 1) : 0,
            breakdown,
          };
        });
      world().commit("trip.estimated", (st) => {
        const tr = st.trips.find((x) => x.id === tripId)!;
        if (tr.status === "RIDE_DRAFT") tr.status = "FARE_ESTIMATED";
      });
      return out;
    },
    async request(tripId, vehicleTypeId) {
      await delay();
      const vt = world().vehicleType(vehicleTypeId);
      const t = world().trip(tripId);
      const rider = world().get().users.find((u) => u.id === t.riderId);
      if (rider && !rider.emailVerified) throw err(403, "Please verify your email before requesting a ride.", "EMAIL_NOT_VERIFIED");
      world().commit("trip.request.prepare", (st) => {
        const tr = st.trips.find((x) => x.id === tripId)!;
        tr.vehicleTypeId = vt.id;
        tr.vehicleTypeCode = vt.code;
        tr.estimatedFare = estimateFor(vt, tr.distanceKm, tr.durationMin, tr.stops.length).total;
        tr.tripPin = generatePin();
        tr.requestedAt = new Date().toISOString();
      });
      world().startMatching(tripId);
      return fullTrip(world().trip(tripId));
    },
    async get(tripId) {
      await delay(120);
      return fullTrip(world().trip(tripId));
    },
    async activeForRider(riderId) {
      await delay(150);
      const t = world()
        .get()
        .trips.filter((x) => x.riderId === riderId && ACTIVE_TRIP_STATUSES.includes(x.status))
        .sort((a, b) => (b.requestedAt ?? b.createdAt).localeCompare(a.requestedAt ?? a.createdAt))[0];
      if (t) world().claimOwnership(t.id);
      return t ? fullTrip(t) : null;
    },
    async activeForDriver(driverId) {
      await delay(150);
      const t = world()
        .get()
        .trips.filter((x) => x.driverId === driverId && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS", "TRIP_COMPLETED", "PAYMENT_PENDING"].includes(x.status))
        .sort((a, b) => (b.matchedAt ?? "").localeCompare(a.matchedAt ?? ""))[0];
      return t ? fullTrip(t) : null;
    },
    async list(filter) {
      await delay(200);
      let list = world().get().trips;
      if (filter.riderId) list = list.filter((t) => t.riderId === filter.riderId);
      if (filter.driverId) list = list.filter((t) => t.driverId === filter.driverId);
      if (filter.status) {
        const arr = Array.isArray(filter.status) ? filter.status : [filter.status];
        list = list.filter((t) => arr.includes(t.status));
      } else {
        list = list.filter((t) => t.status !== "RIDE_DRAFT" && t.status !== "FARE_ESTIMATED");
      }
      list = [...list].sort((a, b) => (b.requestedAt ?? b.createdAt).localeCompare(a.requestedAt ?? a.createdAt));
      if (filter.limit) list = list.slice(0, filter.limit);
      return list.map(fullTrip);
    },
    async cancel(tripId, by, reason, complaint) {
      await delay();
      const t = world().trip(tripId);
      if (TERMINAL_TRIP_STATUSES.includes(t.status)) throw err(409, "This trip is already closed.", "TRIP_CLOSED");
      if (t.status === "TRIP_IN_PROGRESS" && by === "Rider" && !complaint) {
        throw err(409, "A trip in progress can only be cancelled with a complaint explaining why.", "COMPLAINT_REQUIRED");
      }
      if (["TRIP_COMPLETED", "PAYMENT_PENDING"].includes(t.status)) throw err(409, "The trip has already been completed.", "TRIP_COMPLETED");
      const driverCancelBeforePickup = by === "Driver" && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"].includes(t.status);
      world().commit("trip.cancel", (st) => {
        const tr = st.trips.find((x) => x.id === tripId)!;
        const w = world();
        if (complaint) {
          st.complaints.unshift({
            id: uid("cmp"),
            tripId,
            complainantId: by === "Rider" ? tr.riderId : tr.driverId ?? "",
            complainantName: (by === "Rider" ? st.users.find((u) => u.id === tr.riderId)?.name : tr.driver?.name) ?? by,
            complainantRole: by,
            category: complaint.category,
            details: complaint.details,
            status: "Open",
            createdAt: new Date().toISOString(),
          });
        }
        if (tr.driverId) {
          const loc = st.locations[tr.driverId];
          if (loc) loc.status = "Online";
        }
        if (driverCancelBeforePickup) {
          // FR-CAN-04: automatic rematch when the driver cancels
          const prevDriver = tr.driverId!;
          st.sim[tripId] = st.sim[tripId] ?? { ownerTab: w.tabId, heartbeat: Date.now(), round: 1, roundStartedAt: Date.now(), declined: [], npc: false };
          st.sim[tripId].declined.push(prevDriver);
          st.offers = st.offers.filter((o) => o.tripId !== tripId);
          w.notify(st, tr.riderId, "Driver cancelled", "Your driver had to cancel. We're finding you another driver now.", "trip.rematching", tripId);
          w.notify(st, prevDriver, "Trip cancelled", `You cancelled the trip: ${reason}. Repeated cancellations are reviewed by admin.`, "trip.cancelled", tripId);
          tr.status = "REMATCHING";
          tr.driverId = null;
          tr.driver = null;
          tr.matchRoundReached = 1;
          tr.version += 1;
          st.audit.unshift({ id: uid("aud"), adminId: "system", adminName: "System", targetType: "Driver", targetId: prevDriver, targetName: st.drivers.find((d) => d.id === prevDriver)?.name ?? prevDriver, action: "Reject", reason: `Driver cancelled trip ${tripId}: ${reason}`, createdAt: new Date().toISOString() });
        } else {
          tr.status = "CANCELLED";
          tr.cancelledBy = by;
          tr.cancellationReason = reason;
          tr.cancellationFee = by === "Rider" && ["DRIVER_ARRIVED"].includes(t.status) ? 100 : 0;
          tr.version += 1;
          st.offers = st.offers.filter((o) => o.tripId !== tripId);
          delete st.sim[tripId];
          if (tr.driverId) w.notify(st, tr.driverId, "Trip cancelled", `${tr.rider?.name ?? "The rider"} cancelled: ${reason}`, "trip.cancelled", tripId);
          if (by !== "Rider") w.notify(st, tr.riderId, "Trip cancelled", reason, "trip.cancelled", tripId);
        }
      });
      if (driverCancelBeforePickup) {
        // restart matching from the owner tab (the rider's)
        const s = world().get();
        s.sim[tripId].roundStartedAt = Date.now();
        world().commit("trip.rematch.kick", () => {});
      }
      return fullTrip(world().trip(tripId));
    },
    async retry(tripId, vehicleTypeId) {
      await delay();
      const t = world().trip(tripId);
      if (t.status !== "NO_DRIVER_FOUND" && t.status !== "CANCELLED") throw err(409, "Only failed requests can be retried.");
      if (vehicleTypeId) {
        const vt = world().vehicleType(vehicleTypeId);
        world().commit("trip.retry.vehicle", (st) => {
          const tr = st.trips.find((x) => x.id === tripId)!;
          tr.vehicleTypeId = vt.id;
          tr.vehicleTypeCode = vt.code;
          tr.estimatedFare = estimateFor(vt, tr.distanceKm, tr.durationMin, tr.stops.length).total;
        });
      }
      world().commit("trip.retry", (st) => {
        const tr = st.trips.find((x) => x.id === tripId)!;
        tr.requestedAt = new Date().toISOString();
        tr.tripPin = generatePin();
        tr.cancelledBy = null;
        tr.cancellationReason = null;
      });
      world().startMatching(tripId);
      return fullTrip(world().trip(tripId));
    },
    async rate(tripId, raterId, stars, comment) {
      await delay();
      world().commit("trip.rate", (st) => {
        const tr = st.trips.find((x) => x.id === tripId);
        if (!tr) return;
        const ratedId = raterId === tr.riderId ? tr.driverId! : tr.riderId;
        if (st.ratings.some((r) => r.tripId === tripId && r.raterId === raterId)) return;
        st.ratings.push({ id: uid("rt"), tripId, raterId, ratedId, stars: stars as 1 | 2 | 3 | 4 | 5, comment, createdAt: new Date().toISOString() });
        if (raterId === tr.riderId) tr.myRating = stars;
        // rolling average (FR-RATE-05)
        for (const list of [st.users, st.drivers] as User[][]) {
          const u = list.find((x) => x.id === ratedId);
          if (u) {
            u.rating = Math.round(((u.rating * u.ratingCount + stars) / (u.ratingCount + 1)) * 100) / 100;
            u.ratingCount += 1;
          }
        }
      });
    },
    async fileComplaint(tripId, complainantId, category, details) {
      await delay();
      const s = world().get();
      const tr = world().trip(tripId);
      const who = s.users.find((u) => u.id === complainantId) ?? s.drivers.find((d) => d.id === complainantId);
      const c = {
        id: uid("cmp"),
        tripId,
        complainantId,
        complainantName: who?.name ?? "User",
        complainantRole: (complainantId === tr.riderId ? "Rider" : "Driver") as "Rider" | "Driver",
        category,
        details,
        status: "Open" as const,
        createdAt: new Date().toISOString(),
      };
      world().commit("complaint.file", (st) => st.complaints.unshift(c));
      return c;
    },
    async listComplaints(filter) {
      await delay(150);
      let list = world().get().complaints;
      if (filter?.status) list = list.filter((c) => c.status === filter.status);
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async resolveComplaint(id, status, resolution) {
      await delay();
      const admin = world().get().users.find((u) => u.id === currentUserId && u.role === "Admin");
      world().commit("complaint.resolve", (st) => {
        const c = st.complaints.find((x) => x.id === id);
        if (!c) return;
        c.status = status;
        if (resolution) c.resolution = resolution;
        if (status === "Resolved") c.resolvedAt = new Date().toISOString();
        st.audit.unshift({ id: uid("aud"), adminId: admin?.id ?? "usr_admin_01", adminName: admin?.name ?? "Admin", targetType: c.complainantRole, targetId: c.complainantId, targetName: c.complainantName, action: "ResolveComplaint", reason: `${status}${resolution ? `: ${resolution}` : ""} (${c.id})`, createdAt: new Date().toISOString() });
      });
      return world().get().complaints.find((x) => x.id === id)!;
    },
    async triggerSos(tripId, userId, pos) {
      await delay(200);
      const s = world().get();
      const tr = fullTrip(world().trip(tripId));
      const who = s.users.find((u) => u.id === userId) ?? s.drivers.find((d) => d.id === userId);
      const role = userId === tr.riderId ? "Rider" : "Driver";
      const alert = {
        id: uid("sos"),
        tripId,
        triggeredByUserId: userId,
        triggeredByName: who?.name ?? "User",
        role: role as "Rider" | "Driver",
        lat: pos.lat,
        lng: pos.lng,
        status: "Open" as const,
        notes: [],
        triggeredAt: new Date().toISOString(),
        trip: tr,
        history: [{ from: null, to: "Open" as const, by: "System", at: new Date().toISOString() }],
      };
      world().commit("sos.trigger", (st) => {
        st.sos.unshift(alert);
        const contacts = st.contacts.filter((c) => c.userId === userId);
        for (const admin of st.users.filter((u) => u.role === "Admin")) {
          world().notify(st, admin.id, `🚨 ${role} SOS`, `${alert.triggeredByName} triggered SOS on trip ${tripId}.`, "trip.sosTriggered", tripId);
        }
        world().notify(st, userId, "SOS sent", `Admin and ${contacts.length} emergency contact${contacts.length === 1 ? "" : "s"} have been alerted with your live location.`, "trip.sosTriggered", tripId);
      });
      return alert;
    },
    async listSos() {
      await delay(150);
      return [...world().get().sos].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));
    },
    async updateSos(id, status, note) {
      await delay();
      const admin = world().get().users.find((u) => u.id === currentUserId && u.role === "Admin");
      world().commit("sos.update", (st) => {
        const a = st.sos.find((x) => x.id === id);
        if (!a) return;
        const from = a.status;
        a.status = status;
        if (note) a.notes.push(note);
        if (status === "Resolved" || status === "FalseAlarm") a.resolvedAt = new Date().toISOString();
        a.history.push({ from, to: status, by: admin?.name ?? "Admin", at: new Date().toISOString() });
        st.audit.unshift({ id: uid("aud"), adminId: admin?.id ?? "usr_admin_01", adminName: admin?.name ?? "Admin", targetType: a.role, targetId: a.triggeredByUserId, targetName: a.triggeredByName, action: "ResolveSOS", reason: `${from} → ${status}${note ? `: ${note}` : ""} (${a.id})`, createdAt: new Date().toISOString() });
      });
      return world().get().sos.find((x) => x.id === id)!;
    },
    async currentOffer(driverId) {
      const s = world().get();
      const o = s.offers.find((x) => x.driverId === driverId && x.response === "Pending");
      if (!o) return null;
      const expiresAt = new Date(o.offeredAt).getTime() + o.ttlSeconds * 1000;
      if (Date.now() > expiresAt) return null;
      return { ...o, trip: fullTrip(world().trip(o.tripId)) };
    },
    async accept(tripId, driverId) {
      await delay(200);
      const s = world().get();
      const t = world().trip(tripId);
      // FR-MATCH-05: optimistic concurrency — only the first acceptance of a SEARCHING trip succeeds
      if (t.status !== "SEARCHING_DRIVER" && t.status !== "REMATCHING") throw err(409, "This ride was just taken by another driver.", "ALREADY_ASSIGNED");
      const d = s.drivers.find((x) => x.id === driverId);
      if (!d) throw err(404, "Driver not found.");
      world().commit("trip.accept", (st) => {
        const tr = st.trips.find((x) => x.id === tripId)!;
        const dr = st.drivers.find((x) => x.id === driverId)!;
        const o = st.offers.find((x) => x.tripId === tripId && x.driverId === driverId);
        if (o) {
          o.response = "Accepted";
          o.respondedAt = new Date().toISOString();
        }
        world().assignDriver(st, tr, dr, false);
      });
      return fullTrip(world().trip(tripId));
    },
    async decline(tripId, driverId) {
      await delay(120);
      world().commit("trip.decline", (st) => {
        const o = st.offers.find((x) => x.tripId === tripId && x.driverId === driverId && x.response === "Pending");
        if (o) {
          o.response = "Rejected";
          o.respondedAt = new Date().toISOString();
        }
        const sim = st.sim[tripId];
        if (sim && !sim.declined.includes(driverId)) sim.declined.push(driverId);
      });
    },
    async setDriverStatus(tripId, action, pin) {
      await delay(200);
      const t = world().trip(tripId);
      const allowed: Record<typeof action, Trip["status"][]> = {
        EnRoute: ["DRIVER_ASSIGNED"],
        Arrived: ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE"],
        InProgress: ["DRIVER_ARRIVED"],
        Completed: ["TRIP_IN_PROGRESS"],
      };
      if (!allowed[action].includes(t.status)) {
        throw err(409, `Cannot mark trip as ${action} while it is ${t.status.replace(/_/g, " ").toLowerCase()}.`, "INVALID_TRANSITION");
      }
      if (action === "InProgress" && t.tripPin && pin !== t.tripPin) throw err(400, "Incorrect trip PIN. Ask the rider for their 4-digit PIN.", "INVALID_PIN");
      world().commit(`trip.${action}`, (st) => {
        const tr = st.trips.find((x) => x.id === tripId)!;
        const sim = st.sim[tripId];
        const w = world();
        if (action === "EnRoute") {
          tr.status = "DRIVER_EN_ROUTE";
        } else if (action === "Arrived") {
          tr.status = "DRIVER_ARRIVED";
          tr.arrivedAt = new Date().toISOString();
          if (sim) sim.phase = "waiting";
          w.notify(st, tr.riderId, "Your driver has arrived", `${tr.driver?.name} is waiting at ${tr.pickup.name}. PIN: ${tr.tripPin}`, "trip.driverArrived", tripId);
        } else if (action === "InProgress") {
          w.startTrip(st, tr, sim);
        } else if (action === "Completed") {
          w.completeTrip(st, tr, sim);
        }
        tr.version += 1;
      });
      return fullTrip(world().trip(tripId));
    },
    subscribe(tripId, handler) {
      let lastSig = "";
      const unsub = world().subscribe((s) => {
        const t = s.trips.find((x) => x.id === tripId);
        if (!t) return;
        const loc = t.driverId ? s.locations[t.driverId] : undefined;
        const sig = `${t.status}|${t.version}|${t.driverId}|${t.matchRoundReached}|${loc?.lat}|${loc?.lng}|${s.payments.find((p) => p.tripId === tripId)?.status}`;
        if (sig === lastSig) return;
        lastSig = sig;
        handler({ type: "trip.updated", trip: fullTrip(t), location: loc });
      });
      return unsub;
    },
    subscribeDriver(driverId, handler) {
      let lastOffer = "";
      let lastTrip = "";
      const unsub = world().subscribe((s) => {
        const o = s.offers.find((x) => x.driverId === driverId && x.response === "Pending");
        const oSig = o ? `${o.id}` : "";
        if (oSig !== lastOffer) {
          lastOffer = oSig;
          if (o) handler({ type: "offer.received", offer: { ...o, trip: fullTrip(s.trips.find((t) => t.id === o.tripId)!) } });
          else handler({ type: "offer.expired" });
        }
        const recentlyPaid = (x: Trip) => {
          if (x.status !== "PAID") return false;
          const pay = s.payments.find((p) => p.tripId === x.id);
          if (!pay?.processedAt) return false;
          const age = Date.now() - new Date(pay.processedAt).getTime();
          return age >= 0 && age < 120_000;
        };
        const t = s.trips.find((x) => x.driverId === driverId && (["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS", "TRIP_COMPLETED", "PAYMENT_PENDING"].includes(x.status) || recentlyPaid(x)));
        const pay = t ? s.payments.find((p) => p.tripId === t.id) : undefined;
        const tSig = t ? `${t.id}|${t.status}|${t.version}|${pay?.status}|${pay?.method}` : "none";
        if (tSig !== lastTrip) {
          lastTrip = tSig;
          handler({ type: "trip.updated", trip: t ? fullTrip(t) : undefined });
        }
      });
      return unsub;
    },
  },

  /* ---------------------------------------------------------------- */
  payments: {
    async get(tripId) {
      await delay(120);
      return world().get().payments.find((p) => p.tripId === tripId) ?? null;
    },
    async selectMethod(tripId, method) {
      await delay();
      const p = world().get().payments.find((x) => x.tripId === tripId);
      if (!p) throw err(404, "No payment exists for this trip yet.");
      if (p.status === "Paid") throw err(409, "This trip is already paid.");
      if (method === "Card" && p.cardDisabled) throw err(409, "Card payment is disabled after two failed attempts. Please pay in cash.", "CARD_DISABLED");
      world().commit("payment.method", (st) => {
        const pay = st.payments.find((x) => x.tripId === tripId)!;
        const tr = st.trips.find((x) => x.id === tripId)!;
        pay.method = method;
        pay.status = method === "Cash" ? "AwaitingCash" : "Pending";
        pay.processedAt = new Date().toISOString();
        tr.payment = pay;
        if (method === "Cash") world().notify(st, pay.driverId, "Rider is paying cash", `Collect Rs ${pay.finalFare.toLocaleString()} from the rider and confirm receipt.`, "payment.cashSelected", tripId);
      });
      return world().get().payments.find((x) => x.tripId === tripId)!;
    },
    async cardAttempt(tripId, opts) {
      await delay(1400);
      const p = world().get().payments.find((x) => x.tripId === tripId);
      if (!p) throw err(404, "No payment exists for this trip yet.");
      if (p.cardDisabled || p.cardAttemptCount >= 2) throw err(409, "Card payment is disabled after two failed attempts. Please pay in cash.", "CARD_DISABLED");
      const fail = !!opts?.forceFail;
      world().commit("payment.card", (st) => {
        const pay = st.payments.find((x) => x.tripId === tripId)!;
        const tr = st.trips.find((x) => x.id === tripId)!;
        pay.method = "Card";
        pay.cardAttemptCount += 1;
        if (fail) {
          pay.status = "Failed";
          if (pay.cardAttemptCount >= 2) {
            pay.cardDisabled = true;
            pay.method = "Cash";
            pay.status = "AwaitingCash";
            pay.processedAt = new Date().toISOString();
            world().notify(st, pay.riderId, "Card declined twice", "We've switched this trip to cash. Please pay your driver directly.", "payment.failed", tripId);
            world().notify(st, pay.driverId, "Rider is paying cash", `Card failed twice — collect Rs ${pay.finalFare.toLocaleString()} in cash.`, "payment.cashSelected", tripId);
          }
          tr.payment = pay;
        } else {
          world().markPaid(st, tr, pay);
        }
      });
      const out = world().get().payments.find((x) => x.tripId === tripId)!;
      if (fail) throw Object.assign(err(402, out.cardDisabled ? "Card declined again. Card payment is now disabled for this trip — please pay cash." : "Your card was declined. We'll retry once automatically.", out.cardDisabled ? "CARD_DISABLED" : "CARD_DECLINED"), { payment: out });
      return out;
    },
    async confirmCash(tripId) {
      await delay();
      const p = world().get().payments.find((x) => x.tripId === tripId);
      if (!p) throw err(404, "No payment exists for this trip yet.");
      if (p.method !== "Cash") throw err(409, "The rider has not selected cash for this trip.", "NOT_CASH");
      world().commit("payment.cash.confirm", (st) => {
        const pay = st.payments.find((x) => x.tripId === tripId)!;
        const tr = st.trips.find((x) => x.id === tripId)!;
        world().markPaid(st, tr, pay);
      });
      return world().get().payments.find((x) => x.tripId === tripId)!;
    },
    async dispute(tripId, raisedBy, reason) {
      await delay();
      const s = world().get();
      const p = s.payments.find((x) => x.tripId === tripId);
      if (!p) throw err(404, "No payment exists for this trip yet.");
      const who = s.users.find((u) => u.id === raisedBy) ?? s.drivers.find((d) => d.id === raisedBy);
      const d = { id: uid("dsp"), paymentId: p.id, tripId, raisedByUserId: raisedBy, raisedByName: who?.name ?? "User", reason, status: "Open" as const, createdAt: new Date().toISOString() };
      world().commit("payment.dispute", (st) => st.disputes.unshift(d));
      return d;
    },
    async listDisputes() {
      await delay(120);
      return world().get().disputes;
    },
    async resolveDispute(id, status) {
      await delay();
      const admin = world().get().users.find((u) => u.id === currentUserId && u.role === "Admin");
      world().commit("dispute.resolve", (st) => {
        const d = st.disputes.find((x) => x.id === id);
        if (!d) return;
        d.status = status;
        if (status === "Resolved") d.resolvedAt = new Date().toISOString();
        st.audit.unshift({ id: uid("aud"), adminId: admin?.id ?? "usr_admin_01", adminName: admin?.name ?? "Admin", targetType: "Rider", targetId: d.raisedByUserId, targetName: d.raisedByName, action: "ResolveDispute", reason: `${status} (${d.id})`, createdAt: new Date().toISOString() });
      });
      return world().get().disputes.find((x) => x.id === id)!;
    },
    async list(filter) {
      await delay(150);
      let list = world().get().payments;
      if (filter.riderId) list = list.filter((p) => p.riderId === filter.riderId);
      if (filter.driverId) list = list.filter((p) => p.driverId === filter.driverId);
      return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async earnings(driverId, period) {
      await delay(200);
      const s = world().get();
      const paid = s.payments.filter((p) => p.driverId === driverId && p.status === "Paid");
      const now = new Date();
      const buckets: { label: string; start: number; end: number }[] = [];
      if (period === "daily") {
        for (let h = 6; h <= 22; h += 2) {
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h).getTime();
          buckets.push({ label: `${h}:00`, start, end: start + 2 * 3600_000 });
        }
      } else if (period === "weekly") {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          buckets.push({ label: d.toLocaleDateString("en-GB", { weekday: "short" }), start: d.getTime(), end: d.getTime() + 86_400_000 });
        }
      } else {
        for (let i = 3; i >= 0; i--) {
          const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7 + 1).getTime();
          buckets.push({ label: i === 0 ? "This wk" : `${i} wk ago`, start: end - 7 * 86_400_000, end });
        }
      }
      const inRange = (p: Payment) => {
        const t = new Date(p.processedAt ?? p.createdAt).getTime();
        return t >= buckets[0].start && t < buckets[buckets.length - 1].end;
      };
      const scoped = paid.filter(inRange);
      // Seeded history only covers ~2 weeks; synthesize plausible filler for older weekly/monthly buckets
      const series = buckets.map((b, i) => {
        const ps = scoped.filter((p) => {
          const t = new Date(p.processedAt ?? p.createdAt).getTime();
          return t >= b.start && t < b.end;
        });
        let amount = ps.reduce((a, p) => a + p.finalFare, 0);
        let trips = ps.length;
        if (period === "monthly" && i < buckets.length - 1 && trips === 0) {
          trips = 18 + ((i * 7) % 9);
          amount = trips * 1150 + ((i * 131) % 900);
        }
        if (period === "weekly" && trips === 0 && i < 5) {
          trips = 2 + ((i * 3) % 4);
          amount = trips * 980 + ((i * 97) % 500);
        }
        return { label: b.label, amount, trips };
      });
      const total = series.reduce((a, x) => a + x.amount, 0);
      const trips = series.reduce((a, x) => a + x.trips, 0);
      const cash = scoped.filter((p) => p.method === "Cash").reduce((a, p) => a + p.finalFare, 0);
      return {
        period,
        total,
        trips,
        cashCollected: period === "daily" ? cash : Math.round(total * 0.46),
        cardEarnings: period === "daily" ? total - cash : Math.round(total * 0.54),
        onlineMinutes: period === "daily" ? 312 : period === "weekly" ? 1960 : 7820,
        series,
      } satisfies EarningsSummary;
    },
  },

  /* ---------------------------------------------------------------- */
  admin: {
    async dashboard() {
      await delay(250);
      const s = world().get();
      const today = new Date();
      const isToday = (iso?: string | null) => {
        if (!iso) return false;
        const d = new Date(iso);
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      };
      const tripsToday = s.trips.filter((t) => isToday(t.requestedAt ?? t.createdAt));
      const series: AdminDashboardStats["tripsSeries"] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const label = d.toLocaleDateString("en-GB", { weekday: "short" });
        const inDay = s.trips.filter((t) => {
          const x = new Date(t.requestedAt ?? t.createdAt);
          return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate();
        });
        const completed = inDay.filter((t) => t.status === "PAID" || t.status === "CLOSED").length + (i > 0 ? 14 + ((i * 5) % 9) : 0);
        const cancelled = inDay.filter((t) => t.status === "CANCELLED").length + (i > 0 ? 1 + (i % 3) : 0);
        series.push({ label, completed, cancelled });
      }
      return {
        drivers: {
          total: s.drivers.length,
          active: s.drivers.filter((d) => d.profile.status === "Active").length,
          pendingVerification: s.drivers.filter((d) => d.profile.status === "PendingVerification" || d.profile.status === "DocumentReview").length,
          suspended: s.drivers.filter((d) => d.profile.status === "Suspended").length,
          onlineNow: s.drivers.filter((d) => d.profile.online).length,
        },
        trips: {
          today: tripsToday.length,
          completedToday: tripsToday.filter((t) => t.status === "PAID" || t.status === "CLOSED").length,
          cancelledToday: tripsToday.filter((t) => t.status === "CANCELLED").length,
          inProgress: s.trips.filter((t) => ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"].includes(t.status)).length,
          searching: s.trips.filter((t) => t.status === "SEARCHING_DRIVER" || t.status === "REMATCHING").length,
        },
        revenueToday: s.payments.filter((p) => p.status === "Paid" && isToday(p.processedAt)).reduce((a, p) => a + p.finalFare, 0),
        openComplaints: s.complaints.filter((c) => c.status !== "Resolved").length,
        openSos: s.sos.filter((x) => x.status === "Open" || x.status === "Investigating").length,
        tripsSeries: series,
      };
    },
    async auditLog(targetId) {
      await delay(150);
      const list = world().get().audit;
      return targetId ? list.filter((a) => a.targetId === targetId) : list;
    },
  },
};

export type { DriverLocation };
