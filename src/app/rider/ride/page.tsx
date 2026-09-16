"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { LatLng, Place, VehicleType } from "@/types";
import { api } from "@/lib/api";
import { getCurrentPosition, getRoute, reverseGeocode } from "@/lib/geo/providers";
import { ROUTES } from "@/lib/constants";
import { haversineKm } from "@/lib/utils";
import { useCurrentUser } from "@/components/layout/role-guard";
import { MapOverlay, MapSplit, PanelBody } from "@/components/layout/map-split";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { MapView } from "@/components/map";
import { BottomSheet } from "@/components/ui/sheet";
import { FullScreenLoader } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { SosButton } from "@/components/rider/ride-bits";
import {
  type ActiveField,
  CancelReasonPanel,
  CancelledSheet,
  EnRouteSheet,
  InProgressSheet,
  NoDriverSheet,
  PaidSheet,
  PaymentSheet,
  PinDropChrome,
  PlanPanel,
  ReviewSheet,
  SearchingSheet,
  SelectVehicleSheet,
} from "@/components/rider/ride-phases";
import { phaseForTrip, useRideStore } from "@/store/ride-store";

/** Map padding (px) so fitted routes never hide behind the map's own chrome. */
const MAP_PAD = 48;

const PHASE_TITLE: Record<string, string> = {
  plan: "Find a trip",
  select: "Choose a ride",
  review: "Review your ride",
  searching: "Looking for a driver",
  no_driver: "No driver found",
  en_route: "Driver on the way",
  arrived: "Driver has arrived",
  in_progress: "Trip in progress",
  payment: "Payment",
  paid: "Trip complete",
  cancelled: "Trip cancelled",
};

export default function RiderRidePage() {
  const user = useCurrentUser()!;
  const router = useRouter();
  const s = useRideStore();
  const phase = phaseForTrip(s.trip, s.uiPhase);

  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([]);
  const [activeField, setActiveField] = React.useState<ActiveField>(null);
  const [pinDrop, setPinDrop] = React.useState(false);
  const [pinPlace, setPinPlace] = React.useState<Place | null>(null);
  const [pinResolving, setPinResolving] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [userPos, setUserPos] = React.useState<LatLng | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cardResult, setCardResult] = React.useState<{ ok: boolean; message?: string; cardDisabled?: boolean } | null>(null);
  const [sosArmed, setSosArmed] = React.useState(false);
  const [pickupRoute, setPickupRoute] = React.useState<{ tripId: string; driverId: string; geometry: LatLng[] } | null>(null);

  useSetShellHeader({ title: PHASE_TITLE[phase] ?? "Your ride", description: "Map on the left, trip options on the right" });

  /* ---- boot: restore active booking, load vehicle types, locate ---- */
  React.useEffect(() => {
    s.restore(user.id);
    api.trips.vehicleTypes().then(setVehicleTypes).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  const locate = React.useCallback(async () => {
    setLocating(true);
    const { pos } = await getCurrentPosition();
    setUserPos(pos);
    const place = await reverseGeocode(pos);
    s.setPickup(place);
    setLocating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (s.restoring) return;
    // defer so the restore render commits before we kick off geolocation
    const t = setTimeout(() => {
      if (!s.trip && (!s.pickup || s.pickup.address === "Locating…")) locate();
      else if (!userPos) getCurrentPosition().then(({ pos }) => setUserPos(pos));
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.restoring]);

  /* ---- driver → pickup route (FR-PICK-04) ---- */
  const trip = s.trip;
  React.useEffect(() => {
    if (!trip?.driverId || !s.driverLocation) return;
    if (!["DRIVER_ASSIGNED", "DRIVER_EN_ROUTE"].includes(trip.status)) return;
    if (pickupRoute && pickupRoute.tripId === trip.id && pickupRoute.driverId === trip.driverId) return;
    const driverId = trip.driverId;
    const tripId = trip.id;
    getRoute([s.driverLocation, trip.pickup])
      .then((r) => setPickupRoute({ tripId, driverId, geometry: r.geometry }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, trip?.driverId, trip?.status, !!s.driverLocation]);

  /* ---- derived ---- */
  const estimate = s.estimates.find((e) => e.vehicleTypeId === s.selectedVehicleTypeId) ?? null;
  const selectedVt = vehicleTypes.find((v) => v.id === (trip?.vehicleTypeId || s.selectedVehicleTypeId)) ?? null;
  const driverLoc = s.driverLocation;

  const etaToPickup = React.useMemo(
    () => (driverLoc && trip ? Math.max(1, Math.round((haversineKm(driverLoc, trip.pickup) / 22) * 60)) : null),
    [driverLoc, trip],
  );
  const remainingKm = React.useMemo(() => (driverLoc && trip ? haversineKm(driverLoc, trip.destination) * 1.25 : null), [driverLoc, trip]);
  const etaToDest = remainingKm != null ? Math.max(1, Math.round((remainingKm / 22) * 60)) : null;

  const mapRoute = React.useMemo(() => {
    if (!trip) return null;
    const trim = (geom: LatLng[] | undefined | null) => {
      if (!geom || geom.length < 2) return geom ?? null;
      if (!driverLoc) return geom;
      // drop the travelled part of the route for a "remaining" feel
      let bestIdx = 0;
      let best = Infinity;
      geom.forEach((p, i) => {
        const d = haversineKm(p, driverLoc);
        if (d < best) {
          best = d;
          bestIdx = i;
        }
      });
      return [driverLoc, ...geom.slice(bestIdx + 1)];
    };
    if (phase === "en_route" || phase === "arrived") {
      if (phase === "arrived") return null;
      const geom =
        pickupRoute && pickupRoute.tripId === trip.id && pickupRoute.driverId === trip.driverId
          ? pickupRoute.geometry
          : driverLoc
            ? [driverLoc, trip.pickup]
            : null;
      return trim(geom);
    }
    if (phase === "in_progress") return trim(trip.routeGeometry);
    return trip.routeGeometry ?? null;
  }, [trip, phase, driverLoc, pickupRoute]);

  const fitTo = React.useMemo<LatLng[] | undefined>(() => {
    if (pinDrop) return undefined;
    if (!trip) return s.pickup && s.destination ? [s.pickup, s.destination] : undefined;
    switch (phase) {
      case "select":
      case "review":
      case "payment":
      case "paid":
        return trip.routeGeometry && trip.routeGeometry.length > 1 ? [trip.pickup, trip.destination, ...trip.stops] : [trip.pickup, trip.destination];
      case "searching":
      case "no_driver":
        return [trip.pickup];
      case "en_route":
      case "arrived":
        return driverLoc ? [driverLoc, trip.pickup] : [trip.pickup];
      case "in_progress":
        return driverLoc ? [driverLoc, trip.destination] : [trip.pickup, trip.destination];
      default:
        return [trip.pickup, trip.destination];
    }
  }, [trip, phase, driverLoc, s.pickup, s.destination, pinDrop]);

  const mapCenter = React.useMemo(() => {
    if (pinDrop) return s.pickup ?? userPos ?? undefined;
    if (!trip && !s.destination) return s.pickup ?? userPos ?? undefined;
    return undefined;
  }, [pinDrop, trip, s.pickup, s.destination, userPos]);

  /* ---- handlers ---- */
  const onPick = (field: Exclude<ActiveField, null>, p: Place) => {
    if (field === "pickup") s.setPickup(p);
    else if (field === "destination") s.setDestination(p);
    else {
      const i = Number(field.split("-")[1]);
      s.setStops(s.stops.map((x, j) => (j === i ? p : x)));
    }
    setActiveField(null);
  };

  const onSearch = async () => {
    const ok = await s.createDraft(user.id);
    if (!ok && useRideStore.getState().error) toast.error("Couldn't plan this ride", useRideStore.getState().error!);
  };

  const onConfirm = async () => {
    const ok = await s.requestRide();
    if (!ok) {
      const err = useRideStore.getState().error;
      if (err) toast.error("Request failed", err);
    }
  };

  const onCancelConfirm = async (reason: string, complaint?: { category: string; details: string }) => {
    const ok = await s.cancel(reason, complaint);
    setCancelOpen(false);
    if (ok) toast.info("Ride cancelled", complaint ? "Your complaint has been filed for review." : "No worries — book again anytime.");
    else if (useRideStore.getState().error) toast.error("Couldn't cancel", useRideStore.getState().error!);
  };

  const onPayCard = async (forceFail: boolean) => {
    setCardResult(null);
    const r = await s.payByCard(forceFail);
    setCardResult(r);
    if (!r.ok && !r.cardDisabled && r.message) {
      // FR-PAY-07: one automatic retry
      toast.warning("Card declined", "Retrying once automatically…");
      await new Promise((res) => setTimeout(res, 1200));
      const r2 = await s.payByCard(forceFail);
      setCardResult(r2);
      if (!r2.ok && r2.cardDisabled) toast.error("Card disabled for this trip", "Please pay your driver in cash.");
    }
  };

  const onSos = async () => {
    setSosArmed(true);
    await s.triggerSos(user.id);
    setTimeout(() => setSosArmed(false), 4000);
  };

  const goHome = () => {
    s.finish();
    router.replace(ROUTES.rider.home);
  };
  const bookAgain = () => {
    s.finish();
    setActiveField("destination");
    locate();
  };

  const showSos = ["en_route", "arrived", "in_progress"].includes(phase);

  const map = (
    <>
      <MapView
        className="h-full w-full"
        center={mapCenter}
        zoom={15}
        fitTo={fitTo}
        paddingBottom={MAP_PAD}
        paddingTop={MAP_PAD}
        user={userPos}
        pickup={pinDrop ? null : ((trip?.pickup ?? s.pickup) ?? null)}
        destination={trip?.destination ?? s.destination ?? null}
        stops={trip?.stops ?? s.stops}
        searching={phase === "searching"}
        route={mapRoute}
        routeTone={phase === "in_progress" ? "brand" : "ink"}
        driver={driverLoc && trip?.driver && ["en_route", "arrived", "in_progress"].includes(phase) ? { ...driverLoc, code: trip.driver.vehicleTypeCode } : null}
        pinDrop={pinDrop}
        onPinMoveStart={() => setPinResolving(true)}
        onPinMove={async (pos) => {
          setPinResolving(true);
          const place = await reverseGeocode(pos);
          setPinPlace(place);
          setPinResolving(false);
        }}
        draggablePickup={phase === "plan" && !pinDrop}
        onPickupDragEnd={async (pos) => {
          const place = await reverseGeocode(pos);
          s.setPickup(place);
        }}
      />
      <AnimatePresence>
        {showSos && (
          <MapOverlay className="bottom-8 right-6">
            <motion.div key="sos" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
              <SosButton onTrigger={onSos} armed={sosArmed} />
            </motion.div>
          </MapOverlay>
        )}
      </AnimatePresence>
    </>
  );

  if (s.restoring) {
    return (
      <MapSplit map={map}>
        <FullScreenLoader label="Restoring your ride…" />
      </MapSplit>
    );
  }

  return (
    <MapSplit map={map}>
      {pinDrop ? (
        <PinDropChrome
          label={pinPlace?.name ? `${pinPlace.name}${pinPlace.address && pinPlace.address !== pinPlace.name ? ` · ${pinPlace.address}` : ""}` : "Move the map…"}
          resolving={pinResolving}
          onCancel={() => setPinDrop(false)}
          onConfirm={() => {
            if (pinPlace) s.setPickup(pinPlace);
            setPinDrop(false);
          }}
        />
      ) : phase === "plan" ? (
        <PlanPanel
          pickup={s.pickup}
          destination={s.destination}
          stops={s.stops}
          activeField={activeField}
          setActiveField={setActiveField}
          onPick={onPick}
          onUseCurrent={() => {
            setActiveField(null);
            locate();
          }}
          onSetOnMap={() => {
            setActiveField(null);
            setPinPlace(s.pickup);
            setPinDrop(true);
          }}
          onAddStop={() => {
            const i = s.stops.length;
            s.setStops([...s.stops, { name: "", address: "", lat: 0, lng: 0 }]);
            setActiveField(`stop-${i}`);
          }}
          onRemoveStop={(i) => {
            s.setStops(s.stops.filter((_, j) => j !== i));
            setActiveField(null);
          }}
          onSearch={onSearch}
          busy={s.busy}
          error={s.error}
          onBack={() => router.push(ROUTES.rider.home)}
          locating={locating}
        />
      ) : (
        <PanelBody>
          {trip && phase === "select" && (
            <SelectVehicleSheet
              trip={trip}
              vehicleTypes={vehicleTypes}
              estimates={s.estimates}
              selectedId={s.selectedVehicleTypeId}
              onSelect={s.setSelectedVehicle}
              onBack={() => s.setUiPhase("plan")}
              onContinue={() => s.setUiPhase("review")}
              busy={s.busy}
            />
          )}
          {trip && phase === "review" && selectedVt && estimate && (
            <ReviewSheet
              trip={trip}
              vehicleType={selectedVt}
              estimate={estimate}
              paymentPreference={s.paymentPreference}
              onPaymentPreference={s.setPaymentPreference}
              onBack={() => s.setUiPhase("select")}
              onConfirm={onConfirm}
              busy={s.busy}
              error={s.error}
              emailVerified={user.emailVerified}
            />
          )}
          {trip && phase === "searching" && <SearchingSheet trip={trip} vehicleType={selectedVt ?? undefined} onCancel={() => setCancelOpen(true)} busy={s.busy} />}
          {trip && phase === "no_driver" && (
            <NoDriverSheet
              trip={trip}
              vehicleTypes={vehicleTypes}
              estimates={s.estimates}
              onRetry={() => s.retry()}
              onRetryWith={(id) => s.retry(id)}
              onHome={goHome}
              busy={s.busy}
            />
          )}
          {trip && (phase === "en_route" || phase === "arrived") && (
            <EnRouteSheet trip={trip} etaMin={etaToPickup} arrived={phase === "arrived"} onCancel={() => setCancelOpen(true)} />
          )}
          {trip && phase === "in_progress" && <InProgressSheet trip={trip} etaMin={etaToDest} remainingKm={remainingKm} onCancelWithComplaint={() => setCancelOpen(true)} />}
          {trip && phase === "payment" && (
            <PaymentSheet trip={trip} preference={s.paymentPreference} busy={s.busy} cardResult={cardResult} onSelectCash={() => s.selectPayment("Cash")} onPayCard={onPayCard} />
          )}
          {trip && phase === "paid" && (
            <PaidSheet
              trip={trip}
              onRate={(stars, c) => s.rate(user.id, stars, c)}
              onDone={goHome}
              onReceipt={() => {
                const id = trip.id;
                s.finish();
                router.push(ROUTES.rider.trip(id));
              }}
            />
          )}
          {trip && phase === "cancelled" && <CancelledSheet trip={trip} onAgain={bookAgain} onHome={goHome} />}
        </PanelBody>
      )}

      {/* Cancel / complaint sheet */}
      <BottomSheet open={cancelOpen} onClose={() => setCancelOpen(false)} backdrop maxHeight="85%">
        <CancelReasonPanel
          busy={s.busy}
          onClose={() => setCancelOpen(false)}
          onConfirm={onCancelConfirm}
          requireComplaint={phase === "in_progress"}
          feeNote={
            phase === "arrived"
              ? "Your driver has already arrived — a Rs 100 cancellation fee applies."
              : phase === "searching"
                ? "No charge — we haven't matched a driver yet."
                : "Cancelling is free before your driver arrives."
          }
        />
      </BottomSheet>
    </MapSplit>
  );
}
