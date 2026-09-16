"use client";

import { create } from "zustand";
import type { Driver, DriverLocation, DriverOffer, Trip } from "@/types";
import { api, IS_MOCK, errorMessage, type DriverTripAction } from "@/lib/api";
import { world } from "@/lib/mock/world";
import { bearing } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface DriverState {
  driver: Driver | null;
  loading: boolean;
  online: boolean;
  offer: DriverOffer | null;
  trip: Trip | null;
  location: DriverLocation | null;
  busy: boolean;
  error: string | null;

  load: (driverId: string) => Promise<void>;
  start: (driverId: string) => void;
  stop: () => void;
  setOnline: (online: boolean) => Promise<boolean>;
  accept: () => Promise<boolean>;
  decline: () => Promise<void>;
  advance: (action: DriverTripAction, pin?: string) => Promise<boolean>;
  cancel: (reason: string) => Promise<boolean>;
  confirmCash: () => Promise<boolean>;
  rateRider: (stars: number, comment?: string) => Promise<void>;
  triggerSos: () => Promise<void>;
  finishTrip: () => void;
  refresh: () => Promise<void>;
}

let unsub: (() => void) | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let locPoll: ReturnType<typeof setInterval> | null = null;
let geoWatch: number | null = null;
let lastOfferToast = "";
let lastTripToast = "";

export const useDriverStore = create<DriverState>()((set, get) => ({
  driver: null,
  loading: true,
  online: false,
  offer: null,
  trip: null,
  location: null,
  busy: false,
  error: null,

  async load(driverId) {
    set({ loading: true });
    try {
      const [driver, trip, offer, location] = await Promise.all([api.drivers.get(driverId), api.trips.activeForDriver(driverId), api.trips.currentOffer(driverId), api.location.getDriverLocation(driverId)]);
      set({ driver, online: driver.profile.online, trip, offer, location, loading: false });
      if (trip) lastTripToast = `${trip.id}|${trip.status}`;
    } catch (e) {
      set({ loading: false, error: errorMessage(e) });
    }
  },

  start(driverId) {
    get().stop();
    unsub = api.trips.subscribeDriver(driverId, (e) => {
      if (e.type === "offer.received" && e.offer) {
        set({ offer: e.offer });
        if (lastOfferToast !== e.offer.id) {
          lastOfferToast = e.offer.id;
          toast.notify("New ride request", `${e.offer.trip.pickup.name} → ${e.offer.trip.destination.name}`);
          try {
            navigator.vibrate?.([120, 60, 120]);
          } catch {
            /* ignore */
          }
        }
      } else if (e.type === "offer.expired") {
        set({ offer: null });
      } else if (e.type === "trip.updated") {
        const prev = get().trip;
        const t = e.trip ?? null;
        set({ trip: t });
        if (t) {
          const sig = `${t.id}|${t.status}|${t.payment?.status}|${t.payment?.method}`;
          if (sig !== lastTripToast) {
            lastTripToast = sig;
            if (t.status === "CANCELLED" && prev && prev.status !== "CANCELLED") toast.warning("Trip cancelled", t.cancellationReason ?? "The rider cancelled this trip.");
            if (t.payment?.method === "Cash" && t.payment.status === "AwaitingCash" && prev?.payment?.status !== "AwaitingCash") toast.notify("Rider is paying cash", `Collect Rs ${t.payment.finalFare.toLocaleString()} and confirm.`);
            if (t.payment?.status === "Paid" && prev?.payment?.status !== "Paid") toast.success(t.payment.method === "Card" ? "Card payment received" : "Cash confirmed", `Rs ${t.payment.finalFare.toLocaleString()} credited`);
          }
        } else if (prev && ["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_IN_PROGRESS"].includes(prev.status)) {
          // Trip left our active set (rider cancelled) — fetch the terminal state for the UI
          api.trips.get(prev.id).then((full) => set({ trip: full })).catch(() => set({ trip: null }));
        }
      }
    });

    // presence + location
    heartbeat = setInterval(() => {
      const st = get();
      if (!st.online || !st.driver) return;
      if (IS_MOCK) {
        world().presenceOwner = driverId;
        world().heartbeatDriver(driverId);
      }
    }, 1000);

    if (IS_MOCK) {
      locPoll = setInterval(async () => {
        const loc = await api.location.getDriverLocation(driverId);
        if (loc) set({ location: loc });
      }, 1000);
    } else if (typeof navigator !== "undefined" && navigator.geolocation) {
      let last: { lat: number; lng: number } | null = null;
      geoWatch = navigator.geolocation.watchPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
          const heading = p.coords.heading ?? (last ? bearing(last, pos) : 0);
          last = pos;
          const st = get();
          const status = st.trip ? "OnTrip" : st.online ? "Online" : "Offline";
          set({ location: { driverId, ...pos, heading, status, lastUpdated: new Date().toISOString() } });
          if (st.online) api.location.updateDriverLocation(driverId, pos, heading, status).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    }
  },

  stop() {
    unsub?.();
    unsub = null;
    if (heartbeat) clearInterval(heartbeat);
    if (locPoll) clearInterval(locPoll);
    if (geoWatch != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(geoWatch);
    heartbeat = locPoll = null;
    geoWatch = null;
    if (IS_MOCK) world().presenceOwner = null;
  },

  async setOnline(online) {
    const d = get().driver;
    if (!d) return false;
    set({ busy: true, error: null });
    try {
      const driver = await api.drivers.setOnline(d.id, online);
      set({ driver, online: driver.profile.online, busy: false, offer: online ? get().offer : null });
      if (IS_MOCK && online) {
        world().presenceOwner = d.id;
        world().heartbeatDriver(d.id);
      }
      toast[online ? "success" : "info"](online ? "You're online" : "You're offline", online ? "We'll send you nearby ride requests." : "You won't receive ride requests.");
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      toast.error("Couldn't change availability", errorMessage(e));
      return false;
    }
  },

  async accept() {
    const { offer, driver } = get();
    if (!offer || !driver) return false;
    set({ busy: true, error: null });
    try {
      const trip = await api.trips.accept(offer.tripId, driver.id);
      lastTripToast = `${trip.id}|${trip.status}`;
      set({ trip, offer: null, busy: false });
      toast.success("Ride accepted", `Head to ${trip.pickup.name}`);
      return true;
    } catch (e) {
      set({ busy: false, offer: null, error: errorMessage(e) });
      toast.error("Too late", errorMessage(e));
      return false;
    }
  },

  async decline() {
    const { offer, driver } = get();
    if (!offer || !driver) return;
    set({ offer: null });
    await api.trips.decline(offer.tripId, driver.id).catch(() => {});
  },

  async advance(action, pin) {
    const t = get().trip;
    if (!t) return false;
    set({ busy: true, error: null });
    try {
      const trip = await api.trips.setDriverStatus(t.id, action, pin);
      lastTripToast = `${trip.id}|${trip.status}|${trip.payment?.status}|${trip.payment?.method}`;
      set({ trip, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      return false;
    }
  },

  async cancel(reason) {
    const t = get().trip;
    if (!t) return false;
    set({ busy: true, error: null });
    try {
      await api.trips.cancel(t.id, "Driver", reason);
      set({ trip: null, busy: false });
      toast.info("Trip cancelled", "The rider is being re-matched automatically.");
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      toast.error("Couldn't cancel", errorMessage(e));
      return false;
    }
  },

  async confirmCash() {
    const t = get().trip;
    if (!t) return false;
    set({ busy: true, error: null });
    try {
      const payment = await api.payments.confirmCash(t.id);
      set({ trip: { ...t, payment, status: "PAID" }, busy: false });
      return true;
    } catch (e) {
      set({ busy: false, error: errorMessage(e) });
      toast.error("Couldn't confirm cash", errorMessage(e));
      return false;
    }
  },

  async rateRider(stars, comment) {
    const { trip, driver } = get();
    if (!trip || !driver) return;
    await api.trips.rate(trip.id, driver.id, stars, comment).catch(() => {});
  },

  async triggerSos() {
    const { trip, driver, location } = get();
    if (!trip || !driver) return;
    const pos = location ?? trip.pickup;
    try {
      await api.trips.triggerSos(trip.id, driver.id, { lat: pos.lat, lng: pos.lng });
      toast.error("SOS sent", "Admin has been alerted with your live location.");
    } catch (e) {
      toast.error("SOS failed", errorMessage(e));
    }
  },

  finishTrip() {
    set({ trip: null });
  },

  async refresh() {
    const d = get().driver;
    if (!d) return;
    const [driver, trip] = await Promise.all([api.drivers.get(d.id), api.trips.activeForDriver(d.id)]);
    set({ driver, online: driver.profile.online, trip: trip ?? get().trip });
  },
}));
