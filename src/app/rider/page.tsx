"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronRight, Clock, LocateFixed, MailWarning, Search } from "lucide-react";
import type { LatLng, Place } from "@/types";
import { ROUTES } from "@/lib/constants";
import { cn, splitAddress } from "@/lib/utils";
import { useCurrentUser } from "@/components/layout/role-guard";
import { MapOverlay, MapSplit, PanelBody } from "@/components/layout/map-split";
import { useSetShellHeader } from "@/components/layout/shell-header";
import { MapView } from "@/components/map";
import { useRideStore } from "@/store/ride-store";
import { RECENT_PLACES } from "@/components/rider/location-search";
import { getCurrentPosition } from "@/lib/geo/providers";

export default function RiderHomePage() {
    return (
        <React.Suspense fallback={<div className="map-grid h-full w-full" aria-busy="true" />}>
            <RiderHome />
        </React.Suspense>
    );
}

function RiderHome() {
    const user = useCurrentUser()!;
    const router = useRouter();
    const search = useSearchParams();
    const inboxOpen = search.get("inbox") === "1"; // wired up once the inbox story lands

    const [pos, setPos] = React.useState<LatLng | null>(null);

    const setDestination = useRideStore((s) => s.setDestination);

    const greeting = React.useMemo(() => {
        const h = new Date().getHours();
        return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    }, []);

    useSetShellHeader({ title: "Book a ride", description: `Good ${greeting}, ${user.name.split(" ")[0]} 👋` });

    React.useEffect(() => {
        let alive = true;
        getCurrentPosition().then(({ pos }) => alive && setPos(pos));
        return () => {
            alive = false;
        };
    }, []);

    const startRide = (destination?: Place) => {
        if (destination) setDestination(destination);
        router.push(ROUTES.rider.ride);
    };

    return (
        <MapSplit
            map={
                <>
                    <MapView center={pos ?? undefined} zoom={15} user={pos} className="h-full w-full" />
                    <MapOverlay className="bottom-4 right-4">
                        <button
                            type="button"
                            aria-label="Recenter"
                            onClick={() => getCurrentPosition().then(({ pos }) => setPos({ ...pos }))}
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-ink shadow-float transition hover:bg-surface-2"
                        >
                            <LocateFixed size={18} />
                        </button>
                    </MapOverlay>
                </>
            }
        >
            <PanelBody>
                {!user.emailVerified && (
                    <Link
                        href={`${ROUTES.verify}?email=${encodeURIComponent(user.email)}`}
                        className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                    >
                        <MailWarning size={16} /> Verify your email to request rides
                        <ArrowRight size={14} className="ml-auto" />
                    </Link>
                )}

                <h2 className="text-2xl font-semibold leading-tight tracking-tight">Where to?</h2>
                <button
                    type="button"
                    onClick={() => startRide()}
                    className="mt-4 flex h-14 w-full items-center gap-3 rounded-xl bg-surface-2 px-4 text-left text-sm text-zinc-500 transition hover:bg-surface-3"
                >
                    <Search size={18} className="text-ink" />
                    <span className="flex-1 font-medium">Search destination</span>
                    <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-ink shadow-card">Now</span>
                </button>

                <p className="mb-1 mt-6 text-[11px] font-semibold uppercase tracking-wide text-muted">Recent destinations</p>
                <ul>
                    {RECENT_PLACES.map((p, i) => {
                        const { secondary } = splitAddress(p.address);
                        return (
                            <li key={p.name}>
                                <button
                                    type="button"
                                    onClick={() => startRide(p)}
                                    className={cn(
                                        "flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-surface-2",
                                        i < RECENT_PLACES.length - 1 && "border-b border-zinc-100",
                                    )}
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
                                        <Clock size={16} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-semibold">{p.name}</span>
                                        <span className="block truncate text-xs font-normal text-muted">{secondary || p.address}</span>
                                    </span>
                                    <ChevronRight size={16} className="text-zinc-400" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </PanelBody>
        </MapSplit>
    );
}
