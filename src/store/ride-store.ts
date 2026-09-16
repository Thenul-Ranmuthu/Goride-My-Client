"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DriverLocation, FareEstimate, PaymentMethod, Place, Trip } from "@/types";
import { api, errorMessage } from "@/lib/api";
import { ACTIVE_TRIP_STATUSES } from "@/lib/constants";
import { toast } from "@/components/ui/toast";

export type RidePhase =
  | "plan"
  | "select"
  | "review"
  | "searching"
  | "no_driver"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "payment"
  | "paid"
  | "cancelled";

export function phaseForTrip(t: Trip | null, uiPhase: "plan" | "select" | "review"): RidePhase {
  if (!t) return uiPhase;
  switch (t.status) {
    case "RIDE_DRAFT":
    case "FARE_ESTIMATED":
      return uiPhase === "plan" ? "select" : uiPhase;
    case "SEARCHING_DRIVER":
    case "REMATCHING":
      return "searching";
    case "NO_DRIVER_FOUND":
      return "no_driver";
    case "DRIVER_ASSIGNED":
    case "DRIVER_EN_ROUTE":
      return "en_route";
    case "DRIVER_ARRIVED":
      return "arrived";
    case "TRIP_IN_PROGRESS":
      return "in_progress";
    case "TRIP_COMPLETED":
    case "PAYMENT_PENDING":
      return "payment";
    case "PAID":
    case "CLOSED":
      return "paid";
    case "CANCELLED":
      return "cancelled";
  }
}

interface RideState {
  pickup: Place | null;
  destination: Place | null;
  stops: Place[];
  uiPhase: "plan" | "select" | "review";
  trip: Trip | null;
  estimates: FareEstimate[];
  selectedVehicleTypeId: string | null;
  paymentPreference: PaymentMethod;
  driverLocation: DriverLocation | null;
  busy: boolean;
  restoring: boolean;
  error: string | null;

  setPickup: (p: Place | null) => void;
  setDestination: (p: Place | null) => void;
  setStops: (s: Place[]) => void;
  setUiPhase: (p: "plan" | "select" | "review") => void;
  setSelectedVehicle: (id: string) => void;
  setPaymentPreference: (m: PaymentMethod) => void;
  clearError: () => void;

  createDraft: (riderId: string) => Promise<boolean>;
  updateStops: (stops: Place[]) => Promise<void>;
  requestRide: () => Promise<boolean>;
  cancel: (reason: string, complaint?: { category: string; details: string }) => Promise<boolean>;
  retry: (vehicleTypeId?: string) => Promise<boolean>;
  restore: (riderId: string) => Promise<void>;
  refreshTrip: () => Promise<void>;
  selectPayment: (m: PaymentMethod) => Promise<void>;
  payByCard: (forceFail?: boolean) => Promise<{ ok: boolean; message?: string; cardDisabled?: boolean }>;
  rate: (raterId: string, stars: number, comment?: string) => Promise<void>;
  triggerSos: (userId: string) => Promise<void>;
  finish: () => void;
  resetPlanning: () => void;
}

let unsubscribe: (() => void) | null = null;
let lastToastSig = "";

function bind(tripId: string, set: (p: Partial<RideState>) => void, get: () => RideState) {
  unsubscribe?.();
  unsubscribe = api.trips.subscribe(tripId, (e) => {
    if (e.trip) {
      const prev = get().trip;
      set({ trip: e.trip, driverLocation: e.location ?? get().driverLocation });
      // Rider notifications (FR-NOT-01/02/03)
      const sig = `${e.trip.id}|${e.trip.status}|${e.trip.driverId}`;
      if (prev && sig !== lastToastSig) {
        lastToastSig = sig;
        if (e.trip.status === "DRIVER_ASSIGNED" && prev.status !== "DRIVER_ASSIGNED") toast.notify("Driver confirmed", `${e.trip.driver?.name} is on the way · ${e.trip.driver?.vehiclePlate}`);
        if (e.trip.status === "DRIVER_ARRIVED" && prev.status !== "DRIVER_ARRIVED") toast.notify("Your driver has arrived", `Share PIN ${e.trip.tripPin} to start the trip`);
        if (e.trip.status === "REMATCHING" && prev.status !== "REMATCHING") toast.warning("Driver cancelled", "Finding you another driver now…");
        if (e.trip.status === "PAYMENT_PENDING" && prev.status !== "PAYMENT_PENDING") toast.notify("You've arrived", "Complete your payment to finish the trip");
        if (e.trip.status === "NO_DRIVER_FOUND" && prev.status !== "NO_DRIVER_FOUND") toast.error("No drivers available", "Try again or choose another vehicle type");
        if (e.trip.status === "PAID" && prev.status !== "PAID") toast.success("Payment received", "Thanks for riding with GoRide");
      }
    } else if (e.location) {
      set({ driverLocation: e.location });
    }
  });
}

export const useRideStore = create<RideState>()(
  persist(
    (set, get) => ({
      pickup: null,
      destination: null,
      stops: [],
      uiPhase: "plan",
      trip: null,
      estimates: [],
      selectedVehicleTypeId: null,
      paymentPreference: "Cash",
      driverLocation: null,
      busy: false,
      restoring: true,
      error: null,

      setPickup: (pickup) => set({ pickup }),
      setDestination: (destination) => set({ destination }),
      setStops: (stops) => set({ stops }),
      setUiPhase: (uiPhase) => set({ uiPhase }),
      setSelectedVehicle: (selectedVehicleTypeId) => set({ selectedVehicleTypeId }),
      setPaymentPreference: (paymentPreference) => set({ paymentPreference }),
      clearError: () => set({ error: null }),

      async createDraft(riderId) {
        const { pickup, destination, stops } = get();
        if (!pickup || !destination) return false;
        set({ busy: true, error: null });
        try {
          const trip = await api.trips.create({ riderId, pickup, destination, stops });
          const estimates = await api.trips.estimate(trip.id);
          const preferred = get().selectedVehicleTypeId;
          const selected = estimates.find((e) => e.vehicleTypeId === preferred)?.vehicleTypeId ?? estimates.find((e) => e.vehicleTypeCode === "CAR")?.vehicleTypeId ?? estimates[0]?.vehicleTypeId ?? null;
          set({ trip, estimates, selectedVehicleTypeId: selected, uiPhase: "select", busy: false });
          return true;
        } catch (e) {
          set({ busy: false, error: errorMessage(e) });
          return false;
        }
      },

      async updateStops(stops) {
        const t = get().trip;
        set({ stops });
        if (!t) return;
        set({ busy: true });
        try {
          const trip = await api.trips.updateStops(t.id, stops);
          const estimates = await api.trips.estimate(trip.id);
          set({ trip, estimates, busy: false });
        } catch (e) {
          set({ busy: false, error: errorMessage(e) });
        }
      },

      async requestRide() {
        const { trip, selectedVehicleTypeId } = get();
        if (!trip || !selectedVehicleTypeId) return false;
        set({ busy: true, error: null });
        try {
          const t = await api.trips.request(trip.id, selectedVehicleTypeId);
          set({ trip: t, busy: false });
          lastToastSig = `${t.id}|${t.status}|${t.driverId}`;
          bind(t.id, set, get);
          return true;
        } catch (e) {
          set({ busy: false, error: errorMessage(e) });
          return false;
        }
      },

      async cancel(reason, complaint) {
        const t = get().trip;
        if (!t) return false;
        set({ busy: true, error: null });
        try {
          const trip = await api.trips.cancel(t.id, "Rider", reason, complaint);
          set({ trip, busy: false });
          return true;
        } catch (e) {
          set({ busy: false, error: errorMessage(e) });
          return false;
        }
      },

      async retry(vehicleTypeId) {
        const t = get().trip;
        if (!t) return false;
        set({ busy: true, error: null });
        try {
          const trip = await api.trips.retry(t.id, vehicleTypeId);
          set({ trip, busy: false, selectedVehicleTypeId: vehicleTypeId ?? get().selectedVehicleTypeId });
          lastToastSig = `${trip.id}|${trip.status}|${trip.driverId}`;
          bind(trip.id, set, get);
          return true;
        } catch (e) {
          set({ busy: false, error: errorMessage(e) });
          return false;
        }
      },

      async restore(riderId) {
        set({ restoring: true });
        try {
          const active = await api.trips.activeForRider(riderId);
          if (active) {
            lastToastSig = `${active.id}|${active.status}|${active.driverId}`;
            const loc = active.driverId ? await api.location.getDriverLocation(active.driverId) : null;
            set({ trip: active, pickup: active.pickup, destination: active.destination, stops: active.stops, selectedVehicleTypeId: active.vehicleTypeId, driverLocation: loc, restoring: false });
            bind(active.id, set, get);
          } else {
            const t = get().trip;
            // drop stale terminal/draft trips from a previous session
            if (t && !ACTIVE_TRIP_STATUSES.includes(t.status)) set({ trip: null, uiPhase: "plan" });
            set({ restoring: false });
          }
        } catch {
          set({ restoring: false });
        }
      },

      async refreshTrip() {
        const t = get().trip;
        if (!t) return;
        try {
          const trip = await api.trips.get(t.id);
          set({ trip });
        } catch {
          /* ignore */
        }
      },

      async selectPayment(m) {
        const t = get().trip;
        if (!t) return;
        set({ busy: true, error: null });
        try {
          const payment = await api.payments.selectMethod(t.id, m);
          set({ trip: { ...t, payment }, busy: false, paymentPreference: m });
        } catch (e) {
          set({ busy: false, error: errorMessage(e) });
        }
      },

      async payByCard(forceFail) {
        const t = get().trip;
        if (!t) return { ok: false };
        set({ busy: true, error: null });
        try {
          const payment = await api.payments.cardAttempt(t.id, { forceFail });
          set({ trip: { ...t, payment, status: payment.status === "Paid" ? "PAID" : t.status }, busy: false });
          return { ok: true };
        } catch (e) {
          const err = e as { message?: string; code?: string; payment?: Trip["payment"] };
          if (err.payment) set({ trip: { ...t, payment: err.payment } });
          set({ busy: false });
          return { ok: false, message: err.message, cardDisabled: err.code === "CARD_DISABLED" };
        }
      },

      async rate(raterId, stars, comment) {
        const t = get().trip;
        if (!t) return;
        try {
          await api.trips.rate(t.id, raterId, stars, comment);
          set({ trip: { ...t, myRating: stars } });
        } catch (e) {
          toast.error("Couldn't save rating", errorMessage(e));
        }
      },

      async triggerSos(userId) {
        const t = get().trip;
        if (!t) return;
        const pos = get().driverLocation ?? t.pickup;
        try {
          await api.trips.triggerSos(t.id, userId, { lat: pos.lat, lng: pos.lng });
          toast.error("SOS sent", "Admin and your emergency contacts have been alerted with your live location.");
        } catch (e) {
          toast.error("SOS failed", errorMessage(e));
        }
      },

      finish() {
        unsubscribe?.();
        unsubscribe = null;
        set({ trip: null, estimates: [], driverLocation: null, uiPhase: "plan", pickup: null, destination: null, stops: [], error: null });
      },

      resetPlanning() {
        set({ pickup: null, destination: null, stops: [], uiPhase: "plan", estimates: [], trip: get().trip && ACTIVE_TRIP_STATUSES.includes(get().trip!.status) ? get().trip : null, error: null });
      },
    }),
    {
      name: "goride.ride",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ pickup: s.pickup, destination: s.destination, stops: s.stops, selectedVehicleTypeId: s.selectedVehicleTypeId, paymentPreference: s.paymentPreference, uiPhase: s.uiPhase }),
    },
  ),
);
