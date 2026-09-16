"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Calendar, ChevronDown, Clock, CreditCard, History, Star, Wallet } from "lucide-react";
import type { Trip } from "@/types";
import { TRIP_STATUS_META, VEHICLE_IMAGES } from "@/lib/constants";
import { cn, formatDate, formatLKR, formatTime, relativeDay } from "@/lib/utils";
import { Badge, EmptyState, Skeleton } from "@/components/ui/primitives";

/** Theme's RideHistory card: date · time · fare header, then pickup → destination rail. */
export function TripCard({ trip, href, perspective = "rider", index = 0 }: { trip: Trip; href: string; perspective?: "rider" | "driver"; index?: number }) {
  const meta = TRIP_STATUS_META[trip.status];
  const other = perspective === "rider" ? trip.driver?.name : trip.rider?.name;
  const fare = trip.finalFare ?? trip.estimatedFare;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}>
      <Link href={href} className="block rounded-xl border border-zinc-200/80 bg-white px-3 py-3 shadow-card transition hover:border-zinc-300 active:scale-[0.995]">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1">
            <Calendar size={13} /> {formatDate(trip.requestedAt ?? trip.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> {formatTime(trip.requestedAt ?? trip.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            {trip.payment?.method === "Card" ? <CreditCard size={13} /> : <Wallet size={13} />} {formatLKR(fare)}
          </span>
        </div>
        <div className="my-2 h-px bg-zinc-200" />
        <div className="flex items-stretch gap-3">
          <div className="flex w-3 flex-col items-center py-1" aria-hidden>
            <span className="h-3 w-3 rounded-full border-[3px] border-ink bg-brand-400" />
            <span className="w-0 flex-1 border-l-2 border-dashed border-ink" />
            <span className="h-3 w-3 rounded-[3px] border-[3px] border-ink bg-red-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-zinc-600" title={trip.pickup.address}>
              {trip.pickup.name}
            </p>
            <div className="my-1 flex items-center gap-2">
              <span className="h-0.5 flex-1 bg-zinc-200" />
              <span className="text-[10px] font-semibold text-zinc-400">TO</span>
              <span className="h-0.5 flex-1 bg-zinc-200" />
            </div>
            <p className="truncate text-xs text-zinc-600" title={trip.destination.address}>
              {trip.destination.name}
            </p>
          </div>
          <div className="flex flex-col items-end justify-between">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <div className="flex items-center gap-1">
              <Image src={VEHICLE_IMAGES[trip.vehicleTypeCode]} alt="" width={48} height={32} className="h-6 w-9 object-contain mix-blend-multiply" />
              {trip.myRating && perspective === "rider" && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold">
                  <Star size={10} className="fill-amber-400 text-amber-400" /> {trip.myRating}
                </span>
              )}
            </div>
          </div>
        </div>
        {other && <p className="mt-2 truncate text-[11px] text-muted">{perspective === "rider" ? "Driver" : "Rider"}: {other}</p>}
      </Link>
    </motion.div>
  );
}

export function GroupedTripList({ trips, hrefFor, perspective = "rider", loading }: { trips: Trip[] | null; hrefFor: (id: string) => string; perspective?: "rider" | "driver"; loading?: boolean }) {
  const groups = React.useMemo(() => {
    const g: Record<string, Trip[]> = { Today: [], Yesterday: [], Earlier: [] };
    (trips ?? []).forEach((t) => g[relativeDay(t.requestedAt ?? t.createdAt)].push(t));
    return g;
  }, [trips]);

  if (loading || !trips) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (trips.length === 0) return <EmptyState icon={<History size={22} />} title="No trips yet" description={perspective === "rider" ? "Your completed and cancelled rides will appear here." : "Completed trips will appear here once you go online and accept rides."} />;

  let idx = 0;
  return (
    <div className="space-y-4">
      {(["Today", "Yesterday", "Earlier"] as const).map((label) => (
        <details key={label} open className="group">
          <summary className="mb-2 flex cursor-pointer select-none items-center justify-between text-sm font-semibold text-zinc-800">
            <span>
              {label} <span className="ml-1 text-xs font-medium text-muted">({groups[label].length})</span>
            </span>
            <ChevronDown size={18} className="text-zinc-500 transition-transform duration-300 group-open:rotate-180" />
          </summary>
          {groups[label].length === 0 ? (
            <p className={cn("py-2 text-center text-xs text-muted")}>No rides</p>
          ) : (
            <div className="space-y-2">
              {groups[label].map((t) => (
                <TripCard key={t.id} trip={t} href={hrefFor(t.id)} perspective={perspective} index={idx++} />
              ))}
            </div>
          )}
        </details>
      ))}
    </div>
  );
}
