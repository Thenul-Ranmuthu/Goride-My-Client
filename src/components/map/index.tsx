"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./map-view";

/** Leaflet touches `window` at import time — load the map client-side only. */
export const MapView = dynamic<MapViewProps>(() => import("./map-view"), {
    ssr: false,
    loading: () => <div className="map-grid h-full w-full animate-pulse" aria-busy="true" aria-label="Loading map" />,
});

export type { MapViewProps, MapVehicle } from "./map-view";
