// "use client";

// import * as React from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { AlertTriangle, ArrowLeft, Info, MapPinned, X } from "lucide-react";
// import type { FareEstimate, Place, Trip, VehicleType } from "@/types";
// import { Button } from "@/components/ui/button";
// import { RouteRail } from "@/components/ui/primitives";
// import { Spinner } from "@/components/ui/spinner";
// import { SearchInput, SuggestionList, usePlaceSearch, RECENT_PLACES } from "./location-search";
// import { TripMeta, VehicleOption } from "./ride-bits";

// /* ------------------------------------------------------------------ */
// /* 1. Plan panel — pickup / destination selection                       */
// /* ------------------------------------------------------------------ */

// export type ActiveField = "pickup" | "destination" | null;

// export function PlanPanel({
//   pickup,
//   destination,
//   activeField,
//   setActiveField,
//   onPick,
//   onUseCurrent,
//   onSetOnMap,
//   onSearch,
//   busy,
//   error,
//   onBack,
//   locating,
// }: {
//   pickup: Place | null;
//   destination: Place | null;
//   activeField: ActiveField;
//   setActiveField: (f: ActiveField) => void;
//   onPick: (field: Exclude<ActiveField, null>, p: Place) => void;
//   onUseCurrent: () => void;
//   onSetOnMap: () => void;
//   onSearch: () => void;
//   busy: boolean;
//   error: string | null;
//   onBack: () => void;
//   locating: boolean;
// }) {
//   const [query, setQuery] = React.useState("");
//   const [pickupText, setPickupText] = React.useState(pickup?.name ?? "");
//   const [destText, setDestText] = React.useState(destination?.name ?? "");
//   const [prevPickup, setPrevPickup] = React.useState(pickup);
//   const [prevDest, setPrevDest] = React.useState(destination);
//   if (pickup !== prevPickup) {
//     setPrevPickup(pickup);
//     setPickupText(pickup?.name ?? "");
//   }
//   if (destination !== prevDest) {
//     setPrevDest(destination);
//     setDestText(destination?.name ?? "");
//   }

//   const { results, loading } = usePlaceSearch(query, !!activeField);
//   const editing = activeField !== null;
//   const ready = !!pickup && !!destination && !editing;
//   const fieldValue = (f: ActiveField) => (f === "pickup" ? pickupText : f === "destination" ? destText : "");

//   const onChangeField = (f: Exclude<ActiveField, null>, v: string) => {
//     setQuery(v);
//     if (f === "pickup") setPickupText(v);
//     else setDestText(v);
//   };

//   const focusField = (f: Exclude<ActiveField, null>) => {
//     setActiveField(f);
//     setQuery(fieldValue(f));
//   };

//   return (
//     <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="relative flex min-h-0 flex-1 flex-col bg-white">
//       <div className="mx-auto flex w-full max-w-[620px] items-center gap-2 px-4 pt-4">
//         <button type="button" onClick={editing ? () => setActiveField(null) : onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
//           <ArrowLeft size={20} strokeWidth={2.5} />
//         </button>
//         <h1 className="text-xl font-semibold">Find a trip</h1>
//       </div>

//       <div className="mx-auto flex w-full max-w-[620px] items-stretch gap-2 px-5 pt-3">
//         <RouteRail stops={0} className="w-3" />
//         <div className="flex min-w-0 flex-1 flex-col gap-2">
//           <div className="relative">
//             <SearchInput value={fieldValue("pickup")} onChange={(v) => onChangeField("pickup", v)} onFocus={() => focusField("pickup")} onClear={() => onChangeField("pickup", "")} placeholder={locating ? "Locating you…" : "Add a pick-up location"} />
//             {locating && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />}
//           </div>
//           <SearchInput value={fieldValue("destination")} onChange={(v) => onChangeField("destination", v)} onFocus={() => focusField("destination")} onClear={() => onChangeField("destination", "")} placeholder="Add a drop-off location" autoFocus={!destination} />
//         </div>
//       </div>

//       {error && (
//         <p className="mx-auto mt-3 flex w-full max-w-[620px] items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-danger">
//           <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
//         </p>
//       )}

//       <div className="mx-auto min-h-0 w-full max-w-[620px] flex-1 overflow-y-auto scrollbar-visible px-5 pb-4 pt-2">
//         {editing ? (
//           <SuggestionList
//             items={results}
//             loading={loading}
//             emptyQuery={query.trim().length < 2}
//             recents={RECENT_PLACES}
//             onPick={(p) => {
//               onPick(activeField!, p);
//               setQuery("");
//             }}
//             onUseCurrent={activeField === "pickup" ? onUseCurrent : undefined}
//             onSetOnMap={activeField === "pickup" ? onSetOnMap : undefined}
//           />
//         ) : (
//           <AnimatePresence>
//             {ready && (
//               <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-1">
//                 <Button size="lg" loading={busy} loadingText="Calculating fares…" onClick={onSearch}>
//                   Search
//                 </Button>
//               </motion.div>
//             )}
//           </AnimatePresence>
//         )}
//       </div>
//     </motion.div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /* Pin-drop chrome — SCRUM-48                                            */
// /* ------------------------------------------------------------------ */

// export function PinDropChrome({ label, resolving, onConfirm, onCancel }: { label: string; resolving: boolean; onConfirm: () => void; onCancel: () => void }) {
//   return (
//     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col">
//       <div className="mx-auto flex w-full max-w-[620px] items-center gap-2 border-b border-zinc-200/80 px-5 py-3.5">
//         <MapPinned size={18} className="shrink-0 text-brand-600" />
//         <p className="min-w-0 flex-1 text-xs font-semibold">Drag the map to place your pickup pin</p>
//         <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded-lg p-1.5 hover:bg-surface-2">
//           <X size={16} />
//         </button>
//       </div>
//       <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center px-5 py-6">
//         <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Pickup</p>
//         <p className="mt-1 flex items-center gap-2 text-lg font-semibold leading-snug">
//           {resolving && <Spinner className="h-4 w-4 shrink-0 text-brand-600" />} {label}
//         </p>
//         <Button className="mt-5" size="lg" onClick={onConfirm} disabled={resolving}>
//           Confirm pickup
//         </Button>
//       </div>
//     </motion.div>
//   );
// }

// /* ------------------------------------------------------------------ */
// /* 2. Vehicle selection + fare display — SCRUM-53/54                    */
// /* ------------------------------------------------------------------ */

// export function SelectVehicleSheet({
//   trip,
//   vehicleTypes,
//   estimates,
//   selectedId,
//   onSelect,
//   onBack,
// }: {
//   trip: Trip;
//   vehicleTypes: VehicleType[];
//   estimates: FareEstimate[];
//   selectedId: string | null;
//   onSelect: (id: string) => void;
//   onBack: () => void;
// }) {
//   return (
//     <div className="flex flex-col">
//       <div className="mb-3 flex items-center gap-2">
//         <button type="button" onClick={onBack} aria-label="Back to planning" className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-surface-2 hover:text-ink">
//           <ArrowLeft size={18} strokeWidth={2.5} />
//         </button>
//         <h2 className="flex-1 text-lg font-semibold">Choose a ride</h2>
//         <TripMeta distanceKm={trip.distanceKm} durationMin={trip.durationMin} />
//       </div>
//       <div className="flex flex-col gap-1.5">
//         {vehicleTypes.map((vt, i) => (
//           <VehicleOption key={vt.id} vt={vt} estimate={estimates.find((e) => e.vehicleTypeId === vt.id)} selected={vt.id === selectedId} onSelect={() => onSelect(vt.id)} index={i} />
//         ))}
//       </div>
//       <p className="mt-3 flex items-center gap-1.5 text-[11px] font-normal text-muted">
//         <Info size={12} /> Fares are estimates, calculated from route distance and vehicle type (SCRUM-53/54). Trip booking is not implemented yet.
//       </p>
//     </div>
//   );
// }





















"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Check, CreditCard, Info, MapPinned, Plus, RefreshCw, ShieldCheck, Wallet, X } from "lucide-react";
import type { FareEstimate, Place, Trip, VehicleType } from "@/types";
import { CANCEL_REASONS_RIDER, COMPLAINT_CATEGORIES, MATCH_ROUNDS, VEHICLE_IMAGES } from "@/lib/constants";
import { IS_MOCK } from "@/lib/api";
import { cn, formatKm, formatLKR, formatMinutes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, RatingStars, RouteRail, Segmented } from "@/components/ui/primitives";
import { Textarea, Toggle } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { SearchInput, SuggestionList, usePlaceSearch, RECENT_PLACES } from "./location-search";
import { DriverCard, FareBreakdownList, TripMeta, TripRoute, VehicleOption } from "./ride-bits";

/* ------------------------------------------------------------------ */
/* 1. Plan panel (top docked) — FR-RIDE-02..07                          */
/* ------------------------------------------------------------------ */

export type ActiveField = "pickup" | "destination" | `stop-${number}` | null;

export function PlanPanel({
  pickup,
  destination,
  stops,
  activeField,
  setActiveField,
  onPick,
  onUseCurrent,
  onSetOnMap,
  onAddStop,
  onRemoveStop,
  onSearch,
  busy,
  error,
  onBack,
  locating,
}: {
  pickup: Place | null;
  destination: Place | null;
  stops: Place[];
  activeField: ActiveField;
  setActiveField: (f: ActiveField) => void;
  onPick: (field: Exclude<ActiveField, null>, p: Place) => void;
  onUseCurrent: () => void;
  onSetOnMap: () => void;
  onAddStop: () => void;
  onRemoveStop: (i: number) => void;
  onSearch: () => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  locating: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [pickupText, setPickupText] = React.useState(pickup?.name ?? "");
  const [destText, setDestText] = React.useState(destination?.name ?? "");
  const [stopTexts, setStopTexts] = React.useState<string[]>(stops.map((s) => s.name));
  // Keep the text fields in sync when the selected places change (adjust-state-during-render pattern)
  const [prevPickup, setPrevPickup] = React.useState(pickup);
  const [prevDest, setPrevDest] = React.useState(destination);
  const [prevStops, setPrevStops] = React.useState(stops);
  if (pickup !== prevPickup) {
    setPrevPickup(pickup);
    setPickupText(pickup?.name ?? "");
  }
  if (destination !== prevDest) {
    setPrevDest(destination);
    setDestText(destination?.name ?? "");
  }
  if (stops !== prevStops) {
    setPrevStops(stops);
    setStopTexts(stops.map((s) => s.name));
  }

  const { results, loading } = usePlaceSearch(query, !!activeField);
  const editing = activeField !== null;
  const ready = !!pickup && !!destination && !editing;
  const fieldValue = (f: ActiveField) => (f === "pickup" ? pickupText : f === "destination" ? destText : f ? stopTexts[Number(f.split("-")[1])] ?? "" : "");

  const onChangeField = (f: Exclude<ActiveField, null>, v: string) => {
    setQuery(v);
    if (f === "pickup") setPickupText(v);
    else if (f === "destination") setDestText(v);
    else setStopTexts((arr) => arr.map((x, i) => (i === Number(f.split("-")[1]) ? v : x)));
  };

  const focusField = (f: Exclude<ActiveField, null>) => {
    setActiveField(f);
    setQuery(fieldValue(f));
  };

  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 32 }} className="relative flex min-h-0 flex-1 flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[620px] items-center gap-2 px-4 pt-4">
        <button type="button" onClick={editing ? () => setActiveField(null) : onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 className="text-xl font-semibold">Find a trip</h1>
        {stops.length < 2 && !editing && (
          <button type="button" onClick={onAddStop} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-3">
            <Plus size={14} /> Add stop
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[620px] items-stretch gap-2 px-5 pt-3">
        <RouteRail stops={stops.length} className="w-3" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="relative">
            <SearchInput value={fieldValue("pickup")} onChange={(v) => onChangeField("pickup", v)} onFocus={() => focusField("pickup")} onClear={() => onChangeField("pickup", "")} placeholder={locating ? "Locating you…" : "Add a pick-up location"} />
            {locating && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />}
          </div>
          {stops.map((s, i) => (
            <div key={`${s.name}-${i}`} className="relative">
              <SearchInput value={fieldValue(`stop-${i}`)} onChange={(v) => onChangeField(`stop-${i}`, v)} onFocus={() => focusField(`stop-${i}`)} onClear={() => onChangeField(`stop-${i}`, "")} placeholder={`Stop ${i + 1}`} className="pr-8" />
              <button type="button" aria-label="Remove stop" onClick={() => onRemoveStop(i)} className="absolute -right-1 top-1/2 -translate-y-1/2 translate-x-full rounded-full p-1 text-zinc-400 hover:text-danger">
                <X size={14} />
              </button>
            </div>
          ))}
          <SearchInput value={fieldValue("destination")} onChange={(v) => onChangeField("destination", v)} onFocus={() => focusField("destination")} onClear={() => onChangeField("destination", "")} placeholder="Add a drop-off location" autoFocus={!destination} />
        </div>
      </div>

      {error && (
        <p className="mx-auto mt-3 flex w-full max-w-[620px] items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-danger">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      <div className="mx-auto min-h-0 w-full max-w-[620px] flex-1 overflow-y-auto scrollbar-visible px-5 pb-4 pt-2">
        {editing ? (
          <SuggestionList
            items={results}
            loading={loading}
            emptyQuery={query.trim().length < 2}
            recents={RECENT_PLACES}
            onPick={(p) => {
              onPick(activeField!, p);
              setQuery("");
            }}
            onUseCurrent={activeField === "pickup" ? onUseCurrent : undefined}
            onSetOnMap={activeField === "pickup" ? onSetOnMap : undefined}
          />
        ) : (
          <AnimatePresence>
            {ready && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pt-1">
                <Button size="lg" loading={busy} loadingText="Calculating fares…" onClick={onSearch}>
                  Search
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Pin-drop chrome (FR-RIDE-04)                                          */
/* ------------------------------------------------------------------ */

export function PinDropChrome({ label, resolving, onConfirm, onCancel }: { label: string; resolving: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[620px] items-center gap-2 border-b border-zinc-200/80 px-5 py-3.5">
        <MapPinned size={18} className="shrink-0 text-brand-600" />
        <p className="min-w-0 flex-1 text-xs font-semibold">Drag the map to place your pickup pin</p>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="rounded-lg p-1.5 hover:bg-surface-2">
          <X size={16} />
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center px-5 py-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Pickup</p>
        <p className="mt-1 flex items-center gap-2 text-lg font-semibold leading-snug">
          {resolving && <Spinner className="h-4 w-4 shrink-0 text-brand-600" />} {label}
        </p>
        <Button className="mt-5" size="lg" onClick={onConfirm} disabled={resolving}>
          Confirm pickup
        </Button>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Vehicle selection (theme's SelectVehicle sheet) — FR-FARE-*       */
/* ------------------------------------------------------------------ */

export function SelectVehicleSheet({ trip, vehicleTypes, estimates, selectedId, onSelect, onBack, onContinue, busy }: { trip: Trip; vehicleTypes: VehicleType[]; estimates: FareEstimate[]; selectedId: string | null; onSelect: (id: string) => void; onBack: () => void; onContinue: () => void; busy: boolean }) {
  const selected = estimates.find((e) => e.vehicleTypeId === selectedId);
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back to planning" className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <h2 className="flex-1 text-lg font-semibold">Choose a ride</h2>
        <TripMeta distanceKm={trip.distanceKm} durationMin={trip.durationMin} />
      </div>
      <div className="flex flex-col gap-1.5">
        {vehicleTypes.map((vt, i) => (
          <VehicleOption key={vt.id} vt={vt} estimate={estimates.find((e) => e.vehicleTypeId === vt.id)} selected={vt.id === selectedId} onSelect={() => onSelect(vt.id)} index={i} />
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-normal text-muted">
        <Info size={12} /> Fares are estimates — the final fare uses the actual distance and time driven.
      </p>
      <Button className="mt-3" size="lg" disabled={!selected} loading={busy} onClick={onContinue}>
        {selected ? `Continue · ${formatLKR(selected.estimatedFare)}` : "Select a vehicle"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Review & confirm — FR-FARE-05                                     */
/* ------------------------------------------------------------------ */

export function ReviewSheet({ trip, vehicleType, estimate, paymentPreference, onPaymentPreference, onBack, onConfirm, busy, error, emailVerified }: { trip: Trip; vehicleType: VehicleType; estimate: FareEstimate; paymentPreference: "Card" | "Cash"; onPaymentPreference: (m: "Card" | "Cash") => void; onBack: () => void; onConfirm: () => void; busy: boolean; error: string | null; emailVerified: boolean }) {
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center gap-2">
        <button type="button" onClick={onBack} aria-label="Back" className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 hover:bg-surface-2 hover:text-ink">
          <ArrowLeft size={18} strokeWidth={2.5} />
        </button>
        <h2 className="text-lg font-semibold">Review your ride</h2>
      </div>
      <div className="mt-2 flex items-center gap-3 rounded-xl bg-surface-2 p-2 pr-3">
        <Image src={VEHICLE_IMAGES[vehicleType.code]} alt="" width={96} height={64} className="h-12 w-20 object-contain mix-blend-multiply" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {vehicleType.name} <span className="font-normal text-muted">· up to {vehicleType.capacity}</span>
          </p>
          <TripMeta distanceKm={estimate.distanceKm} durationMin={estimate.durationMin} className="mt-0.5" />
        </div>
        <div className="text-right">
          <p className="text-lg font-bold leading-tight">{formatLKR(estimate.estimatedFare)}</p>
          <button type="button" onClick={() => setShowBreakdown((s) => !s)} className="text-[11px] font-semibold text-brand-700 hover:underline">
            {showBreakdown ? "Hide" : "Breakdown"}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {showBreakdown && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <FareBreakdownList estimate={estimate} className="px-1 pt-3" />
          </motion.div>
        )}
      </AnimatePresence>
      <TripRoute trip={trip} className="mt-3" />
      <div className="mt-2">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Pay with</p>
        <Segmented
          value={paymentPreference}
          onChange={onPaymentPreference}
          size="sm"
          options={[
            { value: "Cash", label: <span className="inline-flex items-center gap-1.5"><Wallet size={14} /> Cash</span> },
            { value: "Card", label: <span className="inline-flex items-center gap-1.5"><CreditCard size={14} /> Card</span> },
          ]}
        />
        <p className="mt-1 text-[11px] font-normal text-muted">You confirm payment after the trip ends. Card declines fall back to cash after two attempts.</p>
      </div>
      {!emailVerified && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Verify your email before requesting a ride.
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
      <Button className="mt-4" size="lg" loading={busy} loadingText="Requesting…" onClick={onConfirm} disabled={!emailVerified}>
        Confirm ride · {formatLKR(estimate.estimatedFare)}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Searching — FR-MATCH-06/07/08                                     */
/* ------------------------------------------------------------------ */

export function SearchingSheet({ trip, vehicleType, onCancel, busy }: { trip: Trip; vehicleType?: VehicleType; onCancel: () => void; busy: boolean }) {
  const round = trip.matchRoundReached;
  const cfg = MATCH_ROUNDS[round - 1];
  const rematch = trip.status === "REMATCHING";
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mt-1 flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-brand-400/30 animate-radar" />
        <span className="absolute inset-0 rounded-full bg-brand-400/30 animate-radar-delayed" />
        {vehicleType && <Image src={VEHICLE_IMAGES[vehicleType.code]} alt="" width={64} height={40} className="relative h-10 w-auto object-contain mix-blend-multiply" />}
      </div>
      <h2 className="mt-2 text-lg font-semibold">{rematch ? "Finding you another driver" : "Looking for nearby drivers"}</h2>
      <p className="mt-1 text-xs font-normal text-muted">
        {rematch ? "Your previous driver cancelled — we're re-matching automatically." : `Offering your ride to ${vehicleType?.name ?? "nearby"} drivers within ${cfg.radiusKm} km.`}
      </p>
      <div className="mt-4 w-full">
        <div className="flex items-center justify-between text-[11px] font-semibold">
          <span>Search round {round} of 3</span>
          <span className="text-muted">{cfg.radiusKm} km radius</span>
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {MATCH_ROUNDS.map((r) => (
            <span key={r.round} className={cn("relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200")}>
              {r.round < round && <span className="absolute inset-0 bg-brand-500" />}
              {r.round === round && (
                <motion.span key={`${trip.id}-${round}-${trip.requestedAt}`} className="absolute inset-y-0 left-0 bg-brand-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: r.seconds, ease: "linear" }} />
              )}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 w-full rounded-xl bg-surface-2 p-3 text-left">
        <TripRoute trip={trip} compact />
        <div className="mt-2 flex items-center justify-between border-t border-zinc-200 pt-2 text-xs">
          <span className="font-normal text-muted">Estimated fare</span>
          <span className="font-semibold">{formatLKR(trip.estimatedFare)}</span>
        </div>
      </div>
      <Button className="mt-4" variant="outline" onClick={onCancel} loading={busy}>
        Cancel request
      </Button>
    </div>
  );
}

export function NoDriverSheet({ trip, vehicleTypes, estimates, onRetry, onRetryWith, onHome, busy }: { trip: Trip; vehicleTypes: VehicleType[]; estimates: FareEstimate[]; onRetry: () => void; onRetryWith: (id: string) => void; onHome: () => void; busy: boolean }) {
  const others = vehicleTypes.filter((v) => v.id !== trip.vehicleTypeId);
  return (
    <div className="flex flex-col">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-danger">
          <AlertTriangle size={20} />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">No drivers available right now</h2>
          <p className="mt-1 text-xs font-normal text-muted">We searched three times up to {MATCH_ROUNDS[2].radiusKm} km and no {vehicleTypes.find((v) => v.id === trip.vehicleTypeId)?.name ?? ""} driver accepted. You haven&apos;t been charged.</p>
        </div>
      </div>
      <Button className="mt-4" size="lg" leftIcon={<RefreshCw size={16} />} onClick={onRetry} loading={busy}>
        Try again
      </Button>
      {others.length > 0 && (
        <>
          <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Or choose another vehicle</p>
          <div className="flex flex-col gap-1.5">
            {others.map((vt, i) => (
              <VehicleOption key={vt.id} vt={vt} estimate={estimates.find((e) => e.vehicleTypeId === vt.id)} selected={false} onSelect={() => onRetryWith(vt.id)} index={i} />
            ))}
          </div>
        </>
      )}
      <Button className="mt-3" variant="ghost" onClick={onHome}>
        Back to home
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Driver en route / arrived — FR-PICK-02..04                        */
/* ------------------------------------------------------------------ */

export function EnRouteSheet({ trip, etaMin, onCancel, arrived }: { trip: Trip; etaMin: number | null; onCancel: () => void; arrived?: boolean }) {
  if (!trip.driver) return null;
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-tight">{arrived ? "Your driver has arrived" : "Your driver is on the way"}</h2>
          <p className="text-xs font-normal text-muted">{arrived ? `Meet ${trip.driver.name.split(" ")[0]} at ${trip.pickup.name}` : etaMin != null ? `Arriving in about ${formatMinutes(etaMin)}` : "Calculating arrival time…"}</p>
        </div>
        <Badge tone={arrived ? "success" : "brand"} dot>
          {arrived ? "Arrived" : "En route"}
        </Badge>
      </div>
      <DriverCard driver={trip.driver} pin={trip.tripPin} showPin eta={!arrived && etaMin != null ? `${Math.max(1, Math.round(etaMin))} min` : undefined} />
      {arrived && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs font-semibold text-brand-800">
          <ShieldCheck size={16} /> Check the plate {trip.driver.vehiclePlate} and share your PIN before getting in.
        </div>
      )}
      <TripRoute trip={trip} compact className="mt-3" />
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs">
        <span className="font-normal text-muted">Estimated fare</span>
        <span className="font-semibold">{formatLKR(trip.estimatedFare)}</span>
      </div>
      <Button className="mt-3" variant="outline" onClick={onCancel}>
        Cancel ride
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. In progress — FR-TRIP-01/02, FR-CAN-08                            */
/* ------------------------------------------------------------------ */

export function InProgressSheet({ trip, etaMin, remainingKm, onCancelWithComplaint }: { trip: Trip; etaMin: number | null; remainingKm: number | null; onCancelWithComplaint: () => void }) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-tight">Heading to {trip.destination.name}</h2>
          <p className="text-xs font-normal text-muted">{etaMin != null ? `Arriving in about ${formatMinutes(etaMin)}${remainingKm != null ? ` · ${formatKm(remainingKm)} to go` : ""}` : "On the way"}</p>
        </div>
        <Badge tone="info" dot>
          In trip
        </Badge>
      </div>
      {trip.driver && <DriverCard driver={trip.driver} contact />}
      <TripRoute trip={trip} compact className="mt-3" />
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-xs">
        <span className="font-normal text-muted">Estimated fare</span>
        <span className="font-semibold">{formatLKR(trip.estimatedFare)}</span>
      </div>
      <button type="button" onClick={onCancelWithComplaint} className="mt-3 text-center text-xs font-semibold text-muted underline-offset-2 hover:underline">
        Need to end this trip early? File a complaint
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Payment — FR-PAY-*, FR-CASH-*                                     */
/* ------------------------------------------------------------------ */

export function PaymentSheet({ trip, preference, busy, onSelectCash, onPayCard, cardResult }: { trip: Trip; preference: "Card" | "Cash"; busy: boolean; onSelectCash: () => void; onPayCard: (forceFail: boolean) => void; cardResult: { ok: boolean; message?: string; cardDisabled?: boolean } | null }) {
  const p = trip.payment;
  const [showBreakdown, setShowBreakdown] = React.useState(false);
  const [forceFail, setForceFail] = React.useState(false);
  const [method, setMethod] = React.useState<"Card" | "Cash">(p?.cardDisabled ? "Cash" : p?.method ?? preference);
  const cashSelected = p?.method === "Cash" && p.status === "AwaitingCash";
  const attemptsLeft = 2 - (p?.cardAttemptCount ?? 0);
  const processing = busy && method === "Card" && !cashSelected;

  if (!p) {
    return (
      <div className="flex flex-col items-center py-6 text-center">
        <Spinner className="h-7 w-7 text-brand-600" />
        <p className="mt-3 text-sm font-semibold">Finalising your fare…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold leading-tight">You&apos;ve arrived 🎉</h2>
          <p className="text-xs font-normal text-muted">{trip.pickup.name} → {trip.destination.name}</p>
        </div>
        <Badge tone="success">Completed</Badge>
      </div>

      <div className="mt-3 rounded-xl bg-ink p-4 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/60">Final fare</p>
        <div className="flex items-end justify-between">
          <p className="text-3xl font-bold leading-none tracking-tight">{formatLKR(p.finalFare)}</p>
          <button type="button" onClick={() => setShowBreakdown((s) => !s)} className="text-xs font-semibold text-brand-300 hover:underline">
            {showBreakdown ? "Hide breakdown" : "View breakdown"}
          </button>
        </div>
        {p.estimatedFare !== p.finalFare && <p className="mt-1 text-[11px] text-white/60">Estimate was {formatLKR(p.estimatedFare)}</p>}
      </div>
      <AnimatePresence initial={false}>
        {showBreakdown && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <FareBreakdownList payment={p} className="px-1 pt-3" />
          </motion.div>
        )}
      </AnimatePresence>

      {cashSelected ? (
        <div className="mt-4 flex flex-col items-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 p-4 text-center">
          <Wallet size={22} className="text-brand-700" />
          <p className="mt-2 text-sm font-semibold">Pay {formatLKR(p.finalFare)} in cash to {trip.driver?.name.split(" ")[0]}</p>
          <p className="mt-1 text-xs font-normal text-muted">{p.cardDisabled ? "Card was declined twice, so this trip is now cash only." : "Your driver will confirm once they've received it."}</p>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-800">
            <Spinner className="h-4 w-4" /> Waiting for driver confirmation…
          </div>
        </div>
      ) : (
        <>
          <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted">Payment method</p>
          <div className="grid grid-cols-2 gap-2">
            {(["Card", "Cash"] as const).map((m) => {
              const disabled = m === "Card" && p.cardDisabled;
              const active = method === m && !disabled;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled || processing}
                  onClick={() => setMethod(m)}
                  className={cn("flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition", active ? "border-ink bg-white shadow-card" : "border-transparent bg-surface-2 hover:border-zinc-300", disabled && "opacity-50")}
                >
                  <span className="flex w-full items-center justify-between">
                    {m === "Card" ? <CreditCard size={18} /> : <Wallet size={18} />}
                    {active && <Check size={16} className="text-brand-600" />}
                  </span>
                  <span className="text-sm font-semibold">{m === "Card" ? "Card" : "Cash"}</span>
                  <span className="text-[11px] font-normal leading-tight text-muted">{m === "Card" ? (disabled ? "Disabled after 2 declines" : "Visa •••• 4242 · secure checkout") : "Pay your driver directly"}</span>
                </button>
              );
            })}
          </div>

          {cardResult && !cardResult.ok && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-danger">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {cardResult.message}
            </p>
          )}

          {IS_MOCK && method === "Card" && !p.cardDisabled && (
            <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2">
              <Toggle checked={forceFail} onChange={setForceFail} tone="ink" label={<span className="text-xs">Demo: simulate card decline</span>} description={<span className="text-[10px]">{attemptsLeft === 2 ? "1 automatic retry, then cash fallback" : "Next decline switches this trip to cash"}</span>} />
            </div>
          )}

          {method === "Card" ? (
            <Button className="mt-4" size="lg" loading={processing} loadingText={attemptsLeft === 1 ? "Retrying card…" : "Processing securely…"} onClick={() => onPayCard(forceFail)} leftIcon={<CreditCard size={18} />}>
              Pay {formatLKR(p.finalFare)} by card
            </Button>
          ) : (
            <Button className="mt-4" size="lg" variant="brand" loading={busy} onClick={onSelectCash} leftIcon={<Wallet size={18} />}>
              I&apos;ll pay cash
            </Button>
          )}
          <p className="mt-2 text-center text-[10px] font-normal text-muted">Card details are tokenised by the payment provider — GoRide never stores them.</p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Paid + rating — FR-RATE-01/02                                     */
/* ------------------------------------------------------------------ */

export function PaidSheet({ trip, onRate, onDone, onReceipt }: { trip: Trip; onRate: (stars: number, comment?: string) => Promise<void>; onDone: () => void; onReceipt: () => void }) {
  const [stars, setStars] = React.useState(trip.myRating ?? 0);
  const [comment, setComment] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const rated = !!trip.myRating;
  const p = trip.payment;
  return (
    <div className="flex flex-col items-center text-center">
      <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-400 text-ink">
        <Check size={28} strokeWidth={3} />
      </motion.span>
      <h2 className="mt-3 text-lg font-semibold">Payment received</h2>
      <p className="text-xs font-normal text-muted">
        {formatLKR(p?.finalFare ?? trip.finalFare)} paid by {p?.method ?? "—"} · Receipt {p?.receiptNo}
      </p>

      {trip.driver && (
        <div className="mt-5 w-full rounded-xl bg-surface-2 p-4">
          <p className="text-sm font-semibold">{rated ? `You rated ${trip.driver.name.split(" ")[0]}` : `How was your trip with ${trip.driver.name.split(" ")[0]}?`}</p>
          <RatingStars value={stars} onChange={rated ? undefined : setStars} readOnly={rated} className="mt-2" />
          {!rated && stars > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 overflow-hidden text-left">
              <Textarea placeholder={stars >= 4 ? "What went well? (optional)" : "Tell us what happened (optional)"} value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-20 bg-white" />
            </motion.div>
          )}
        </div>
      )}

      <div className="mt-4 flex w-full flex-col gap-2">
        {!rated && stars > 0 ? (
          <Button
            size="lg"
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await onRate(stars, comment.trim() || undefined);
              setSaving(false);
            }}
          >
            Submit rating
          </Button>
        ) : (
          <Button size="lg" onClick={onDone}>
            Done
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReceipt}>
            View receipt
          </Button>
          {!rated && (
            <Button variant="ghost" onClick={onDone}>
              Skip rating
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Cancelled                                                          */
/* ------------------------------------------------------------------ */

export function CancelledSheet({ trip, onAgain, onHome }: { trip: Trip; onAgain: () => void; onHome: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-danger">
        <X size={24} strokeWidth={3} />
      </span>
      <h2 className="mt-3 text-lg font-semibold">Trip cancelled</h2>
      <p className="text-xs font-normal text-muted">
        {trip.cancelledBy === "Rider" ? "You cancelled this trip." : trip.cancelledBy === "Driver" ? "Your driver cancelled this trip." : "This trip was cancelled."}
        {trip.cancellationReason ? ` Reason: ${trip.cancellationReason}.` : ""}
      </p>
      {trip.cancellationFee ? <Badge tone="warning" className="mt-3">Cancellation fee {formatLKR(trip.cancellationFee)}</Badge> : <Badge tone="success" className="mt-3">No cancellation fee</Badge>}
      <Button className="mt-5" size="lg" onClick={onAgain}>
        Book another ride
      </Button>
      <Button className="mt-2" variant="ghost" onClick={onHome}>
        Back to home
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cancel sheet (reason picker) — FR-CAN-01/02                           */
/* ------------------------------------------------------------------ */

export function CancelReasonPanel({ feeNote, onConfirm, onClose, busy, requireComplaint }: { feeNote?: string; onConfirm: (reason: string, complaint?: { category: string; details: string }) => void; onClose: () => void; busy: boolean; requireComplaint?: boolean }) {
  const [reason, setReason] = React.useState<string>(requireComplaint ? COMPLAINT_CATEGORIES[0] : CANCEL_REASONS_RIDER[0]);
  const [details, setDetails] = React.useState("");
  const reasons = requireComplaint ? COMPLAINT_CATEGORIES : CANCEL_REASONS_RIDER;
  const canSubmit = requireComplaint ? details.trim().length >= 10 : true;
  return (
    <div className="flex flex-col">
      <h2 className="text-lg font-semibold">{requireComplaint ? "End trip with a complaint" : "Why are you cancelling?"}</h2>
      <p className="mt-0.5 text-xs font-normal text-muted">{requireComplaint ? "A trip in progress can only be cancelled with a complaint, which goes straight to our safety team." : feeNote ?? "Cancelling is free before your driver arrives."}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {reasons.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className={cn("flex items-center justify-between rounded-xl border-2 px-3 py-2.5 text-left text-sm font-medium transition", reason === r ? "border-ink bg-white" : "border-transparent bg-surface-2 hover:border-zinc-300")}>
            {r}
            {reason === r && <Check size={16} />}
          </button>
        ))}
      </div>
      {requireComplaint && <Textarea className="mt-3" placeholder="Describe what happened (at least 10 characters)" value={details} onChange={(e) => setDetails(e.target.value)} />}
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Keep ride
        </Button>
        <Button variant="danger" loading={busy} disabled={!canSubmit} onClick={() => onConfirm(reason, requireComplaint ? { category: reason, details: details.trim() } : undefined)}>
          {requireComplaint ? "File & end trip" : "Cancel ride"}
        </Button>
      </div>
    </div>
  );
}
