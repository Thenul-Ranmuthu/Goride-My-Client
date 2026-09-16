








"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { AlertOctagon, Clock3, CreditCard, MessageSquare, Phone, Route, Users, Wallet } from "lucide-react";
import type { FareEstimate, Payment, Trip, TripDriverSummary, VehicleType } from "@/types";
import { cn, formatKm, formatLKR, formatMinutes, splitAddress } from "@/lib/utils";
import { VEHICLE_IMAGES } from "@/lib/constants";
import { Avatar, Badge, RatingInline, RouteRail } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

/* ------------------------------------------------------------------ */
/* Trip route summary (pickup → stops → destination)                    */
/* ------------------------------------------------------------------ */

export function TripRoute({ trip, compact, className }: { trip: Pick<Trip, "pickup" | "destination" | "stops">; compact?: boolean; className?: string }) {
  const rows = [trip.pickup, ...trip.stops, trip.destination];
  return (
    <div className={cn("flex items-stretch gap-3", className)}>
      <RouteRail stops={trip.stops.length} className="w-3" />
      <div className="flex min-w-0 flex-1 flex-col">
        {rows.map((p, i) => {
          const { secondary } = splitAddress(p.address);
          const last = i === rows.length - 1;
          return (
            <div key={`${p.name}-${i}`} className={cn("min-w-0 py-2", !last && "border-b border-zinc-100")}>
              <p className={cn("truncate font-semibold leading-tight", compact ? "text-sm" : "text-[15px]")}>{p.name}</p>
              {!compact && <p className="truncate text-xs font-normal text-muted">{secondary || p.address}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TripMeta({ distanceKm, durationMin, className }: { distanceKm: number; durationMin: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-xs font-semibold text-muted", className)}>
      <span className="inline-flex items-center gap-1">
        <Route size={13} /> {formatKm(distanceKm)}
      </span>
      <span className="h-3 w-px bg-zinc-300" />
      <span className="inline-flex items-center gap-1">
        <Clock3 size={13} /> {formatMinutes(durationMin)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicle option (theme's SelectVehicle card)                          */
/* ------------------------------------------------------------------ */

export function VehicleOption({ vt, estimate, selected, onSelect, index = 0 }: { vt: VehicleType; estimate?: FareEstimate; selected: boolean; onSelect: () => void; index?: number }) {
  // Only TukTuk is bookable in this stage -- every other vehicle type is
  // display-only, even though its fare is real (calculated by
  // goride-trip-matching, same as TukTuk's).
  const isTuk = vt.code === "TUK" || (vt.code as string) === "TUKTUK";
  const isAvailable = isTuk;
  const displayName = isTuk ? "Tuk Tuk" : vt.name;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 320, damping: 28 }}
      onClick={isAvailable ? onSelect : undefined}
      disabled={!isAvailable}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border-[3px] bg-surface-2/70 px-2 py-2 text-left transition-all duration-150",
        !isAvailable && "opacity-60 cursor-not-allowed",
        selected ? "border-ink bg-white shadow-card" : isAvailable ? "border-transparent hover:border-zinc-300" : "border-transparent",
      )}
    >
      <Image src={VEHICLE_IMAGES[vt.code] ?? "/vehicles/car.png"} alt={displayName} width={96} height={64} className={cn("h-14 w-24 shrink-0 object-contain mix-blend-multiply transition-transform", selected && "scale-105")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-semibold leading-tight">{displayName}</span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted">
            <Users size={11} /> {vt.capacity}
          </span>
          {!isAvailable && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
              Unavailable
            </span>
          )}
        </span>
        <span className="block truncate text-xs font-normal text-muted">{vt.description}</span>
        {estimate && <span className="mt-0.5 block text-[11px] font-semibold text-brand-700">{estimate.etaMin > 0 ? `${estimate.etaMin} min away` : "Searching wider area"}</span>}
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-[15px] font-bold">{estimate ? formatLKR(estimate.estimatedFare) : "—"}</span>
        <span className="block text-[10px] font-medium text-muted">estimate</span>
      </span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Driver card                                                          */
/* ------------------------------------------------------------------ */

export function DriverCard({ driver, pin, showPin, eta, className, contact = true }: { driver: TripDriverSummary; pin?: string | null; showPin?: boolean; eta?: string; className?: string; contact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-3">
        <Avatar name={driver.name} src={driver.photoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-tight">{driver.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <RatingInline value={driver.rating} count={driver.ratingCount} />
            {eta && <Badge tone="brand">{eta}</Badge>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold leading-tight tracking-tight">{driver.vehiclePlate}</p>
          <p className="truncate text-[11px] text-muted">
            {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-surface-2 p-2 pr-3">
        <Image src={VEHICLE_IMAGES[driver.vehicleTypeCode]} alt="" width={96} height={64} className="h-12 w-20 object-contain mix-blend-multiply" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-normal text-muted">Look for this vehicle</p>
          <p className="truncate text-sm font-semibold">
            {driver.vehicleColor} {driver.vehicleMake} {driver.vehicleModel}
          </p>
        </div>
        {showPin && pin && (
          <div className="rounded-lg bg-ink px-3 py-1.5 text-center text-white">
            <p className="text-[9px] font-semibold uppercase tracking-widest opacity-70">Trip PIN</p>
            <p className="text-lg font-bold leading-none tracking-[0.25em]">{pin}</p>
          </div>
        )}
      </div>
      {contact && (
        <div className="flex gap-2">
          <Button variant="secondary" size="md" leftIcon={<MessageSquare size={16} />} href={`sms:${driver.phone ?? ""}`} className="text-xs">
            Message driver
          </Button>
          <a href={`tel:${driver.phone ?? ""}`} aria-label="Call driver" className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 hover:bg-surface-3">
            <Phone size={18} />
          </a>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fare rows                                                            */
/* ------------------------------------------------------------------ */

export function FareBreakdownList({ payment, estimate, className }: { payment?: Payment | null; estimate?: FareEstimate | null; className?: string }) {
  const b = payment?.breakdown ?? estimate?.breakdown;
  if (!b) return null;
  const rows = [
    ["Base fare", b.base],
    ["Distance", b.distance],
    ["Time", b.time],
    ...(b.stops ? [["Stops", b.stops] as const] : []),
    ...(b.waiting ? [["Waiting", b.waiting] as const] : []),
  ] as const;
  return (
    <dl className={cn("space-y-1.5 text-sm", className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between font-normal text-zinc-600">
          <dt>{k}</dt>
          <dd>{formatLKR(v)}</dd>
        </div>
      ))}
      <div className="flex justify-between border-t border-zinc-200 pt-2 font-semibold">
        <dt>{payment ? "Final fare" : "Estimated fare"}</dt>
        <dd>{formatLKR(b.total)}</dd>
      </div>
      {payment && payment.estimatedFare !== payment.finalFare && (
        <p className="text-[11px] font-normal text-muted">
          Estimate was {formatLKR(payment.estimatedFare)} — final fare reflects the actual distance and time driven.
        </p>
      )}
    </dl>
  );
}

export function PaymentMethodRow({ method, className }: { method: Payment["method"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      {method === "Card" ? <CreditCard size={14} /> : <Wallet size={14} />}
      {method ?? "Not selected"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* SOS floating button (FR-SOS-01, NFR-USE-02: ≤ 2 taps)                */
/* ------------------------------------------------------------------ */

export function SosButton({ onTrigger, className, armed }: { onTrigger: () => void; className?: string; armed?: boolean }) {
  const [holding, setHolding] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setProgress(0);
  };
  const start = () => {
    setHolding(true);
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200);
      setProgress(p);
      if (p >= 1) {
        stop();
        onTrigger();
      }
    }, 40);
  };
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <button
        type="button"
        aria-label="Hold to send SOS"
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onTrigger();
          }
        }}
        className={cn("relative flex h-14 w-14 select-none items-center justify-center rounded-full bg-danger text-white shadow-float transition-transform active:scale-95", armed && "ring-4 ring-red-200")}
        style={{ touchAction: "none" }}
      >
        <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 56 56" aria-hidden>
          <circle cx="28" cy="28" r="25" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" />
          <circle cx="28" cy="28" r="25" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray={`${2 * Math.PI * 25}`} strokeDashoffset={`${2 * Math.PI * 25 * (1 - progress)}`} strokeLinecap="round" />
        </svg>
        {holding ? <span className="text-[10px] font-bold">HOLD</span> : <AlertOctagon size={22} />}
      </button>
      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-danger shadow-card">SOS</span>
    </div>
  );
}
