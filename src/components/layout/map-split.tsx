"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * MapSplit — the ride-flow layout: the live map on the left, the trip options
 * on the right, 50/50 on desktop. Below `lg` the map keeps a fixed slice at the
 * top and the options column takes the rest, so the flow still works on a phone.
 */
export function MapSplit({ map, children, className }: { map: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex h-full w-full flex-col overflow-hidden lg:flex-row", className)}>
            <div className="relative h-[38%] min-h-[200px] w-full shrink-0 lg:h-full lg:min-h-0 lg:w-1/2">{map}</div>
            <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t border-zinc-200 bg-white lg:h-full lg:w-1/2 lg:flex-none lg:border-l lg:border-t-0">
                {children}
            </section>
        </div>
    );
}

/** Sticky title row for the options column. */
export function PanelHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return <header className={cn("flex shrink-0 items-center gap-3 border-b border-zinc-200/80 px-5 py-3.5", className)}>{children}</header>;
}

/** Scrolling body for the options column, capped at a readable measure. */
export function PanelBody({ children, className, contentClassName }: { children: React.ReactNode; className?: string; contentClassName?: string }) {
    return (
        <div className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-visible", className)}>
            <div className={cn("mx-auto w-full max-w-[620px] px-5 py-5", contentClassName)}>{children}</div>
        </div>
    );
}

/** A floating control that sits on top of the map column. */
export function MapOverlay({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("absolute z-10", className)}>{children}</div>;
}
