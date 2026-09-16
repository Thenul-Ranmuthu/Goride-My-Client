/**
 * MockWorld — an in-browser stand-in for the four GoRide services.
 *
 * • State lives in localStorage so an active booking survives refresh
 *   (FR-PICK-08 / FR-TRIP-07) and is shared across tabs via BroadcastChannel,
 *   which lets a rider tab and a driver tab in the same browser talk to each
 *   other exactly as they would through the gateway + SignalR.
 * • A 1 s tick drives the simulation: 3-round radius-expansion matching,
 *   NPC driver movement, auto-progression for NPC drivers, offer TTLs.
 * • Every mutation goes through commit() → persisted → broadcast → listeners.
 */
import type {
  AdminAction,
  AppNotification,
  Complaint,
  Driver,
  DriverLocation,
  DriverOffer,
  EmergencyContact,
  LatLng,
  NotificationPreferences,
  Payment,
  PaymentDispute,
  Rating,
  SosAlert,
  Trip,
  User,
  VehicleType,
  VehicleTypeCode,
} from "@/types";
import { DRIVER_OFFER_TTL_SECONDS, MATCH_ROUNDS } from "@/lib/constants";
import { clamp, haversineKm, pathLengthKm, pointAlong, uid } from "@/lib/utils";
import { getRoute } from "@/lib/geo/providers";
import {
  ALL_USERS,
  AUDIT_LOG,
  COMPLAINTS,
  DEMO_ADMIN,
  DEMO_RIDER,
  DRIVERS,
  DRIVER_START_LOCATIONS,
  EMERGENCY_CONTACTS,
  NOTIFICATIONS,
  SOS_ALERTS,
  TRIPS,
  VEHICLE_TYPES,
  estimateFor,
} from "./seed";

export const WORLD_KEY = "goride.mock.world.v3";
const CHANNEL = "goride-mock-world";

// Fallback pool for generateRandomDriver() -- only the seed data's 1-2
// eligible (Active + online) drivers per vehicle type exist for real
// matching, so a trip can otherwise dead-end at NO_DRIVER_FOUND just because
// that one driver is busy on another trip. These let matching always resolve.
const RANDOM_DRIVER_NAMES = [
  "Sunil Perera", "Nimal Rathnayake", "Chathura Jayawardena", "Kavindu Senanayake",
  "Ranjith Abeysekara", "Malith Gunaratne", "Thilina Kumara", "Sachin Wijesinghe",
  "Anura Dissanayake", "Prasanna Herath", "Chamila Rodrigo", "Buddhika Ekanayake",
];

const RANDOM_DRIVER_VEHICLES: Record<VehicleTypeCode, { make: string; model: string }[]> = {
  TUK: [
    { make: "Bajaj", model: "RE" },
    { make: "TVS", model: "King" },
    { make: "Piaggio", model: "Ape" },
  ],
  BIKE: [
    { make: "Honda", model: "Dio" },
    { make: "Yamaha", model: "FZ" },
    { make: "TVS", model: "Ntorq" },
  ],
  CAR: [
    { make: "Toyota", model: "Aqua" },
    { make: "Suzuki", model: "Wagon R" },
    { make: "Honda", model: "Fit" },
  ],
  XL: [
    { make: "Toyota", model: "KDH" },
    { make: "Nissan", model: "Caravan" },
  ],
};

const RANDOM_DRIVER_COLORS = ["White", "Silver", "Black", "Red", "Blue", "Green"];

interface TripSim {
  ownerTab: string;
  heartbeat: number;
  round: 1 | 2 | 3;
  roundStartedAt: number;
  declined: string[];
  npc: boolean;
  /** movement */
  route?: LatLng[];
  routeKm?: number;
  moveStartedAt?: number;
  moveDurationMs?: number;
  phase?: "toPickup" | "waiting" | "toDestination" | "done";
  waitUntil?: number;
  loadingRoute?: boolean;
}

export interface WorldState {
  seededAt: number;
  users: User[];
  drivers: Driver[];
  vehicleTypes: VehicleType[];
  trips: Trip[];
  offers: DriverOffer[];
  payments: Payment[];
  disputes: PaymentDispute[];
  complaints: Complaint[];
  sos: SosAlert[];
  audit: AdminAction[];
  notifications: AppNotification[];
  contacts: EmergencyContact[];
  prefs: NotificationPreferences[];
  ratings: Rating[];
  locations: Record<string, DriverLocation>;
  presence: Record<string, number>; // driverId -> last heartbeat ms (a human driver tab is open & online)
  sim: Record<string, TripSim>;
}

export type WorldListener = (state: WorldState, reason: string) => void;

function seedState(): WorldState {
  const locations: Record<string, DriverLocation> = {};
  for (const d of DRIVERS) {
    const at = DRIVER_START_LOCATIONS[d.id];
    locations[d.id] = {
      driverId: d.id,
      lat: at.lat + (Math.random() - 0.5) * 0.004,
      lng: at.lng + (Math.random() - 0.5) * 0.004,
      heading: Math.random() * 360,
      status: d.profile.online ? "Online" : "Offline",
      lastUpdated: new Date().toISOString(),
    };
  }
  const payments = TRIPS.filter((t) => t.payment).map((t) => t.payment!);
  return {
    seededAt: Date.now(),
    users: structuredClone(ALL_USERS),
    drivers: structuredClone(DRIVERS),
    vehicleTypes: structuredClone(VEHICLE_TYPES),
    trips: structuredClone(TRIPS),
    offers: [],
    payments: structuredClone(payments),
    disputes: [],
    complaints: structuredClone(COMPLAINTS),
    sos: structuredClone(SOS_ALERTS),
    audit: structuredClone(AUDIT_LOG),
    notifications: structuredClone(NOTIFICATIONS),
    contacts: structuredClone(EMERGENCY_CONTACTS),
    prefs: [
      { userId: DEMO_RIDER.id, pushEnabled: true, smsEnabled: false, emailEnabled: true },
      { userId: "usr_driver_01", pushEnabled: true, smsEnabled: true, emailEnabled: false },
      { userId: DEMO_ADMIN.id, pushEnabled: true, smsEnabled: false, emailEnabled: true },
    ],
    ratings: [],
    locations,
    presence: {},
    sim: {},
  };
}

class MockWorld {
  private state: WorldState | null = null;
  private listeners = new Set<WorldListener>();
  private channel: BroadcastChannel | null = null;
  private ticker: ReturnType<typeof setInterval> | null = null;
  readonly tabId: string;

  constructor() {
    this.tabId = this.resolveTabId();
  }

  private resolveTabId() {
    if (typeof window === "undefined") return "server";
    let id = sessionStorage.getItem("goride.tab");
    if (!id) {
      id = uid("tab");
      sessionStorage.setItem("goride.tab", id);
    }
    return id;
  }

  /* ------------------------------------------------------------ */
  /* Lifecycle                                                      */
  /* ------------------------------------------------------------ */

  get(): WorldState {
    if (this.state) return this.state;
    if (typeof window === "undefined") {
      this.state = seedState();
      return this.state;
    }
    try {
      const raw = localStorage.getItem(WORLD_KEY);
      this.state = raw ? (JSON.parse(raw) as WorldState) : seedState();
    } catch {
      this.state = seedState();
    }
    this.boot();
    return this.state;
  }

  private boot() {
    if (typeof window === "undefined" || this.channel) return;
    this.channel = new BroadcastChannel(CHANNEL);
    this.channel.onmessage = (ev) => {
      if (ev.data?.type === "changed" && ev.data.tab !== this.tabId) this.reload(ev.data.reason ?? "remote");
    };
    window.addEventListener("storage", (e) => {
      if (e.key === WORLD_KEY) this.reload("storage");
    });
    if (!this.ticker) this.ticker = setInterval(() => this.tick(), 1000);
    if (!localStorage.getItem(WORLD_KEY)) this.persist();
  }

  private reload(reason: string) {
    try {
      const raw = localStorage.getItem(WORLD_KEY);
      if (raw) this.state = JSON.parse(raw) as WorldState;
    } catch {
      /* ignore */
    }
    this.emit(reason);
  }

  reset() {
    this.state = seedState();
    this.persist();
    this.broadcast("reset");
    this.emit("reset");
  }

  subscribe(fn: WorldListener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(reason: string) {
    const s = this.get();
    this.listeners.forEach((l) => {
      try {
        l(s, reason);
      } catch (e) {
        console.error(e);
      }
    });
  }

  private persist() {
    if (typeof window === "undefined" || !this.state) return;
    localStorage.setItem(WORLD_KEY, JSON.stringify(this.state));
  }

  private broadcast(reason: string) {
    this.channel?.postMessage({ type: "changed", tab: this.tabId, reason });
  }

  /** Mutate → persist → broadcast → notify. */
  commit(reason: string, mutate: (s: WorldState) => void) {
    const s = this.get();
    mutate(s);
    this.persist();
    this.broadcast(reason);
    this.emit(reason);
  }

  /* ------------------------------------------------------------ */
  /* Helpers                                                        */
  /* ------------------------------------------------------------ */

  trip(id: string) {
    const t = this.get().trips.find((x) => x.id === id);
    if (!t) throw Object.assign(new Error("Trip not found"), { status: 404 });
    return t;
  }

  driver(id: string) {
    const d = this.get().drivers.find((x) => x.id === id);
    if (!d) throw Object.assign(new Error("Driver not found"), { status: 404 });
    return d;
  }

  vehicleType(idOrCode: string) {
    const vt = this.get().vehicleTypes.find((v) => v.id === idOrCode || v.code === idOrCode);
    if (!vt) throw Object.assign(new Error("Vehicle type not found"), { status: 404 });
    return vt;
  }

  driverSummary(d: Driver) {
    return {
      id: d.id,
      name: d.name,
      phone: d.phone ?? undefined,
      photoUrl: d.profilePhotoUrl,
      rating: d.rating,
      ratingCount: d.ratingCount,
      vehicleMake: d.profile.vehicleMake,
      vehicleModel: d.profile.vehicleModel,
      vehicleColor: d.profile.vehicleColor,
      vehiclePlate: d.profile.vehiclePlate,
      vehicleTypeCode: d.profile.vehicleTypeCode,
    };
  }

  notify(s: WorldState, userId: string, title: string, message: string, template: string, tripId?: string) {
    s.notifications.unshift({
      id: uid("ntf"),
      userId,
      tripId: tripId ?? null,
      channel: "Push",
      template,
      title,
      message,
      status: "Sent",
      read: false,
      sentAt: new Date().toISOString(),
    });
  }

  isHumanDriverPresent(driverId: string) {
    const hb = this.get().presence[driverId];
    return !!hb && Date.now() - hb < 4000;
  }

  /** Called by the driver tab every tick while the driver is online. */
  heartbeatDriver(driverId: string) {
    const s = this.get();
    s.presence[driverId] = Date.now();
    // presence is high-churn; persist without emitting to avoid render storms
    this.persist();
  }

  claimOwnership(tripId: string) {
    const s = this.get();
    const sim = s.sim[tripId];
    if (!sim) return;
    if (sim.ownerTab !== this.tabId && Date.now() - sim.heartbeat > 5000) {
      this.commit("sim.claim", (st) => {
        st.sim[tripId].ownerTab = this.tabId;
        st.sim[tripId].heartbeat = Date.now();
      });
    }
  }

  /* ------------------------------------------------------------ */
  /* Matching                                                       */
  /* ------------------------------------------------------------ */

  startMatching(tripId: string, rematch = false) {
    this.commit(rematch ? "trip.rematching" : "trip.requested", (s) => {
      const t = s.trips.find((x) => x.id === tripId)!;
      t.status = rematch ? "REMATCHING" : "SEARCHING_DRIVER";
      t.requestedAt = t.requestedAt ?? new Date().toISOString();
      t.matchRoundReached = 1;
      t.driverId = null;
      t.driver = null;
      s.sim[tripId] = {
        ownerTab: this.tabId,
        heartbeat: Date.now(),
        round: 1,
        roundStartedAt: Date.now(),
        declined: rematch ? (s.sim[tripId]?.declined ?? []) : [],
        npc: false,
      };
      s.offers = s.offers.filter((o) => o.tripId !== tripId);
    });
  }

  private eligibleDrivers(s: WorldState, t: Trip, radiusKm: number, declined: string[]) {
    const busy = new Set(
      s.trips
        .filter((x) => ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS", "TRIP_COMPLETED", "PAYMENT_PENDING"].includes(x.status) && x.driverId)
        .map((x) => x.driverId!),
    );
    return s.drivers.filter((d) => {
      if (d.profile.status !== "Active" || !d.profile.online) return false;
      if (d.profile.vehicleTypeCode !== t.vehicleTypeCode) return false;
      if (busy.has(d.id) || declined.includes(d.id)) return false;
      const loc = s.locations[d.id];
      if (!loc) return false;
      return haversineKm(loc, t.pickup) <= radiusKm;
    });
  }

  private tickMatching(s: WorldState, t: Trip, sim: TripSim): boolean {
    let changed = false;
    const now = Date.now();
    const roundCfg = MATCH_ROUNDS[sim.round - 1];
    const pending = s.offers.find((o) => o.tripId === t.id && o.response === "Pending");

    if (pending) {
      const expiresAt = new Date(pending.offeredAt).getTime() + pending.ttlSeconds * 1000;
      if (now > expiresAt) {
        pending.response = "TimedOut";
        pending.respondedAt = new Date().toISOString();
        sim.declined.push(pending.driverId);
        changed = true;
      } else {
        return false; // wait for the human driver to respond
      }
    }

    const elapsed = now - sim.roundStartedAt;
    const candidates = this.eligibleDrivers(s, t, roundCfg.radiusKm, sim.declined);
    const human = candidates.find((d) => this.isHumanDriverPresent(d.id) && !s.offers.some((o) => o.tripId === t.id && o.driverId === d.id));

    if (human) {
      s.offers.push({
        id: uid("off"),
        tripId: t.id,
        driverId: human.id,
        round: sim.round,
        offeredAt: new Date().toISOString(),
        response: "Pending",
        ttlSeconds: DRIVER_OFFER_TTL_SECONDS,
        trip: structuredClone(t),
      });
      this.notify(s, human.id, "New ride request", `${t.pickup.name} → ${t.destination.name}`, "trip.offer", t.id);
      return true;
    }

    const npcCandidates = candidates.filter((d) => !this.isHumanDriverPresent(d.id));
    // NPC drivers "deliberate" for a bit before one of them accepts
    if (npcCandidates.length > 0 && elapsed >= roundCfg.seconds * 600) {
      const chosen = npcCandidates[Math.floor(Math.random() * npcCandidates.length)];
      this.assignDriver(s, t, chosen, true);
      return true;
    }

    if (elapsed >= roundCfg.seconds * 1000) {
      if (sim.round < 3) {
        sim.round = (sim.round + 1) as 1 | 2 | 3;
        sim.roundStartedAt = now;
        t.matchRoundReached = sim.round;
        changed = true;
      } else {
        // No real driver was found after 3 full rounds -- rather than dead-end
        // the trip with NO_DRIVER_FOUND, generate a one-off driver of the
        // rider's selected vehicle type and assign them directly.
        const randomDriver = this.generateRandomDriver(s, t.vehicleTypeCode, t.pickup);
        this.assignDriver(s, t, randomDriver, true);
        changed = true;
      }
    }
    return changed;
  }

  assignDriver(s: WorldState, t: Trip, d: Driver, npc: boolean) {
    t.status = "DRIVER_ASSIGNED";
    t.driverId = d.id;
    t.driver = this.driverSummary(d);
    t.matchedAt = new Date().toISOString();
    t.version += 1;
    s.offers = s.offers.filter((o) => o.tripId !== t.id || o.driverId === d.id);
    const sim = s.sim[t.id];
    if (sim) {
      sim.npc = npc;
      sim.phase = "toPickup";
      sim.route = undefined;
      sim.loadingRoute = false;
    }
    const loc = s.locations[d.id];
    if (loc) loc.status = "OnTrip";
    this.notify(s, t.riderId, "Driver confirmed", `${d.name} is on the way in a ${d.profile.vehicleColor ?? ""} ${d.profile.vehicleMake} ${d.profile.vehicleModel} (${d.profile.vehiclePlate}).`, "trip.driverAssigned", t.id);
  }

  /**
   * Fallback for when real matching exhausts all 3 rounds with nobody
   * eligible -- generates a one-off driver of the rider's selected vehicle
   * type and registers them into the world so a trip never dead-ends at
   * NO_DRIVER_FOUND just because the seed data only has 1-2 eligible drivers
   * per type (see RANDOM_DRIVER_* above).
   */
  private generateRandomDriver(s: WorldState, vehicleTypeCode: VehicleTypeCode, near: LatLng): Driver {
    const name = RANDOM_DRIVER_NAMES[Math.floor(Math.random() * RANDOM_DRIVER_NAMES.length)];
    const options = RANDOM_DRIVER_VEHICLES[vehicleTypeCode];
    const vehicle = options[Math.floor(Math.random() * options.length)];
    const color = RANDOM_DRIVER_COLORS[Math.floor(Math.random() * RANDOM_DRIVER_COLORS.length)];
    const id = uid("usr_driver_random");
    const plate = `R${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;

    const driver: Driver = {
      id,
      name,
      email: `${id}@goride.lk`,
      phone: `+94 7${Math.floor(Math.random() * 10)} ${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
      role: "Driver",
      profilePhotoUrl: null,
      emailVerified: true,
      phoneVerified: true,
      rating: Math.round((4 + Math.random()) * 10) / 10,
      ratingCount: Math.floor(Math.random() * 300),
      createdAt: new Date().toISOString(),
      profile: {
        driverId: id,
        vehicleMake: vehicle.make,
        vehicleModel: vehicle.model,
        vehiclePlate: plate,
        vehicleColor: color,
        vehicleTypeCode,
        licenseNumber: `B${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
        licenseExpiry: new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10),
        status: "Active",
        verifiedAt: new Date().toISOString(),
        online: true,
        documents: [],
      },
    };

    s.drivers.push(driver);
    // Place the new driver a short random distance from pickup so the "en
    // route to pickup" leg looks like a real short drive, not a teleport.
    const jitterLat = (Math.random() - 0.5) * 0.02; // roughly ±1km
    const jitterLng = (Math.random() - 0.5) * 0.02;
    s.locations[id] = {
      driverId: id,
      lat: near.lat + jitterLat,
      lng: near.lng + jitterLng,
      heading: Math.floor(Math.random() * 360),
      status: "OnTrip",
      lastUpdated: new Date().toISOString(),
    };

    return driver;
  }

  /* ------------------------------------------------------------ */
  /* Movement / auto-progression                                    */
  /* ------------------------------------------------------------ */

  private ensureRoute(s: WorldState, t: Trip, sim: TripSim, from: LatLng, to: LatLng) {
    if (sim.route || sim.loadingRoute) return;
    sim.loadingRoute = true;
    getRoute([from, to])
      .then((r) => {
        this.commit("sim.route", (st) => {
          const sm = st.sim[t.id];
          if (!sm) return;
          sm.route = r.geometry;
          sm.routeKm = r.distanceKm;
          sm.loadingRoute = false;
          sm.moveStartedAt = Date.now();
          // demo-speed: 25 km/h, clamped to 25–80 s per leg
          sm.moveDurationMs = clamp((r.distanceKm / 25) * 3600 * 1000, 25_000, 80_000);
        });
      })
      .catch(() => {
        this.commit("sim.route.fail", (st) => {
          const sm = st.sim[t.id];
          if (sm) sm.loadingRoute = false;
        });
      });
  }

  /** Advance the driver's marker along the current leg. Returns true when the leg is complete. */
  private moveAlong(s: WorldState, t: Trip, sim: TripSim): boolean {
    if (!sim.route || !sim.moveStartedAt || !sim.moveDurationMs || !t.driverId) return false;
    const f = clamp((Date.now() - sim.moveStartedAt) / sim.moveDurationMs, 0, 1);
    const { point, heading } = pointAlong(sim.route, f);
    s.locations[t.driverId] = { driverId: t.driverId, lat: point.lat, lng: point.lng, heading, status: "OnTrip", lastUpdated: new Date().toISOString() };
    return f >= 1;
  }

  private tickAssigned(s: WorldState, t: Trip, sim: TripSim): boolean {
    if (!t.driverId) return false;
    const driverLoc = s.locations[t.driverId];
    const human = !sim.npc;

    switch (t.status) {
      case "DRIVER_ASSIGNED":
      case "DRIVER_EN_ROUTE": {
        if (t.status === "DRIVER_ASSIGNED") {
          t.status = "DRIVER_EN_ROUTE";
        }
        if (sim.phase !== "toPickup") {
          sim.phase = "toPickup";
          sim.route = undefined;
        }
        this.ensureRoute(s, t, sim, driverLoc ?? t.pickup, t.pickup);
        const arrived = this.moveAlong(s, t, sim);
        if (arrived && !human) {
          t.status = "DRIVER_ARRIVED";
          t.arrivedAt = new Date().toISOString();
          sim.phase = "waiting";
          sim.waitUntil = Date.now() + 8000;
          this.notify(s, t.riderId, "Your driver has arrived", `${t.driver?.name} is waiting at ${t.pickup.name}.`, "trip.driverArrived", t.id);
        }
        return true;
      }
      case "DRIVER_ARRIVED": {
        if (!human && sim.waitUntil && Date.now() >= sim.waitUntil) {
          this.startTrip(s, t, sim);
        }
        return true;
      }
      case "TRIP_IN_PROGRESS": {
        if (sim.phase !== "toDestination") {
          sim.phase = "toDestination";
          sim.route = undefined;
        }
        this.ensureRoute(s, t, sim, driverLoc ?? t.pickup, t.destination);
        const done = this.moveAlong(s, t, sim);
        if (done && !human) this.completeTrip(s, t, sim);
        return true;
      }
      default:
        return false;
    }
  }

  startTrip(s: WorldState, t: Trip, sim?: TripSim) {
    t.status = "TRIP_IN_PROGRESS";
    t.startedAt = new Date().toISOString();
    t.version += 1;
    const sm = sim ?? s.sim[t.id];
    if (sm) {
      sm.phase = "toDestination";
      sm.route = undefined;
      sm.loadingRoute = false;
    }
    this.notify(s, t.riderId, "Trip started", `Heading to ${t.destination.name}. Share your trip status from the SOS menu anytime.`, "trip.started", t.id);
  }

  completeTrip(s: WorldState, t: Trip, sim?: TripSim) {
    t.status = "PAYMENT_PENDING";
    t.completedAt = new Date().toISOString();
    t.version += 1;
    const sm = sim ?? s.sim[t.id];
    if (sm) sm.phase = "done";
    const vt = this.vehicleType(t.vehicleTypeId);
    const actualKm = Math.round((sm?.routeKm ?? t.distanceKm) * 10) / 10 || t.distanceKm;
    const actualMin = t.startedAt ? Math.max(t.durationMin * 0.9, (Date.now() - new Date(t.startedAt).getTime()) / 60000 + t.durationMin * 0.85) : t.durationMin;
    const est = t.estimatedFare ?? estimateFor(vt, t.distanceKm, t.durationMin, t.stops.length).total;
    const breakdown = estimateFor(vt, Math.max(actualKm, t.distanceKm * 0.95), Math.round(actualMin), t.stops.length);
    // keep final within a believable band of the estimate
    breakdown.total = clamp(breakdown.total, Math.round(est * 0.95), Math.round(est * 1.12));
    t.finalFare = breakdown.total;
    const payment: Payment = {
      id: uid("pay"),
      tripId: t.id,
      riderId: t.riderId,
      driverId: t.driverId!,
      estimatedFare: est,
      finalFare: breakdown.total,
      breakdown,
      method: null,
      cardAttemptCount: 0,
      cardDisabled: false,
      status: "Pending",
      createdAt: new Date().toISOString(),
    };
    s.payments = s.payments.filter((p) => p.tripId !== t.id);
    s.payments.push(payment);
    t.payment = payment;
    const loc = s.locations[t.driverId!];
    if (loc) loc.status = "Online";
    this.notify(s, t.riderId, "You've arrived", `Trip completed. Final fare Rs ${breakdown.total.toLocaleString()}.`, "trip.completed", t.id);
    this.notify(s, t.driverId!, "Trip completed", `Fare Rs ${breakdown.total.toLocaleString()} — awaiting rider payment.`, "trip.completed", t.id);
  }

  /* ------------------------------------------------------------ */
  /* Tick                                                           */
  /* ------------------------------------------------------------ */

  private tick() {
    const s = this.state;
    if (!s || typeof window === "undefined") return;
    let changed = false;
    const now = Date.now();

    for (const t of s.trips) {
      const sim = s.sim[t.id];
      if (!sim) continue;
      const owner = sim.ownerTab === this.tabId;
      const active = ["SEARCHING_DRIVER", "REMATCHING", "DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"].includes(t.status);
      if (!active) continue;

      // Human-driver legs are simulated by the driver's own tab; everything else by the owner (rider) tab.
      const humanDriving = !sim.npc && !!t.driverId && this.isHumanDriverPresent(t.driverId);
      const iAmDriverTab = !!t.driverId && this.presenceOwner === t.driverId;

      if (t.status === "SEARCHING_DRIVER" || t.status === "REMATCHING") {
        if (owner) {
          sim.heartbeat = now;
          if (this.tickMatching(s, t, sim)) changed = true;
        }
      } else if (humanDriving) {
        if (iAmDriverTab) {
          if (this.tickAssigned(s, t, sim)) changed = true;
        }
      } else if (owner) {
        sim.heartbeat = now;
        if (this.tickAssigned(s, t, sim)) changed = true;
      }
    }

    // Expire stale NPC cash payments: NPC driver confirms cash ~6 s after rider selects it
    for (const p of s.payments) {
      if (p.status === "AwaitingCash" && p.method === "Cash") {
        const t = s.trips.find((x) => x.id === p.tripId);
        const sim = t ? s.sim[t.id] : undefined;
        if (t && sim?.npc && sim.ownerTab === this.tabId && now - new Date(p.processedAt ?? p.createdAt).getTime() > 6000) {
          this.markPaid(s, t, p);
          changed = true;
        }
      }
    }

    if (changed) {
      this.persist();
      this.broadcast("tick");
      this.emit("tick");
    }
  }

  /** Which driver (if any) this tab is "driving" for. Set by the driver store. */
  presenceOwner: string | null = null;

  markPaid(s: WorldState, t: Trip, p: Payment) {
    p.status = "Paid";
    p.processedAt = new Date().toISOString();
    p.receiptNo = p.receiptNo ?? `GR-${String(Date.now()).slice(-8)}`;
    t.status = "PAID";
    t.payment = p;
    t.version += 1;
    this.notify(s, t.riderId, "Payment received", `Rs ${p.finalFare.toLocaleString()} paid by ${p.method}. Receipt ${p.receiptNo} emailed to you.`, "payment.processed", t.id);
    this.notify(s, t.driverId!, p.method === "Card" ? "Card payment received" : "Cash confirmed", `Rs ${p.finalFare.toLocaleString()} for trip ${t.pickup.name} → ${t.destination.name}.`, "payment.processed", t.id);
    delete s.sim[t.id];
  }

  /* ------------------------------------------------------------ */
  /* Utility for nearby NPC drivers on the rider home map           */
  /* ------------------------------------------------------------ */

  nearby(pos: LatLng, vehicleType?: VehicleTypeCode, radiusKm = 4) {
    const s = this.get();
    return Object.values(s.locations).filter((l) => {
      if (l.status === "Offline") return false;
      const d = s.drivers.find((x) => x.id === l.driverId);
      if (!d || d.profile.status !== "Active") return false;
      if (vehicleType && d.profile.vehicleTypeCode !== vehicleType) return false;
      return haversineKm(l, pos) <= radiusKm;
    });
  }

  /** Gentle idle drift for online NPC drivers so the home map feels alive. */
  driftIdleDrivers() {
    const s = this.get();
    const busy = new Set(s.trips.filter((t) => t.driverId && !["PAID", "CLOSED", "CANCELLED", "NO_DRIVER_FOUND"].includes(t.status)).map((t) => t.driverId!));
    for (const l of Object.values(s.locations)) {
      if (l.status !== "Online" || busy.has(l.driverId) || this.isHumanDriverPresent(l.driverId)) continue;
      const rad = (l.heading * Math.PI) / 180;
      l.lat += Math.cos(rad) * 0.00012;
      l.lng += Math.sin(rad) * 0.00012;
      l.heading = (l.heading + (Math.random() - 0.5) * 40 + 360) % 360;
      l.lastUpdated = new Date().toISOString();
    }
    this.persist();
  }

  distanceKmOfRoute(route?: LatLng[]) {
    return route ? pathLengthKm(route) : 0;
  }
}

let singleton: MockWorld | null = null;
export function world(): MockWorld {
  if (!singleton) singleton = new MockWorld();
  return singleton;
}
