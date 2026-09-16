"use client";

import "leaflet/dist/leaflet.css";
import * as React from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { DriverLocation, LatLng, VehicleTypeCode } from "@/types";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { destinationIcon, pickupIcon, searchingIcon, sosIcon, stopIcon, userIcon, vehicleIcon } from "./icons";

/* Light, label-sparse basemap that matches the theme's grey map texture. */
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const TILE_URL_LABELS = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

export interface MapVehicle {
    id: string;
    pos: LatLng;
    heading?: number;
    code: VehicleTypeCode;
    active?: boolean;
    dim?: boolean;
}

export interface MapViewProps {
    className?: string;
    center?: LatLng;
    zoom?: number;
    /** Fit the viewport to these points whenever they change (debounced). */
    fitTo?: LatLng[];
    fitPadding?: [number, number];
    /** Bottom padding (px) to keep content above docked sheets. */
    paddingBottom?: number;
    paddingTop?: number;
    user?: LatLng | null;
    pickup?: LatLng | null;
    destination?: LatLng | null;
    stops?: LatLng[];
    searching?: boolean;
    route?: LatLng[] | null;
    routeTone?: "ink" | "brand" | "muted";
    vehicles?: MapVehicle[];
    driver?: (DriverLocation & { code: VehicleTypeCode }) | null;
    sos?: LatLng[];
    /** Pin-drop mode: the map pans under a fixed centre pin; reports the centre on move end. */
    pinDrop?: boolean;
    onPinMove?: (pos: LatLng) => void;
    onPinMoveStart?: () => void;
    draggablePickup?: boolean;
    onPickupDragEnd?: (pos: LatLng) => void;
    interactive?: boolean;
    onReady?: (map: L.Map) => void;
    children?: React.ReactNode;
}

function FitBounds({ points, padding, paddingBottom, paddingTop }: { points?: LatLng[]; padding: [number, number]; paddingBottom: number; paddingTop: number }) {
    const map = useMap();
    const key = points?.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|") ?? "";
    React.useEffect(() => {
        if (!points || points.length === 0) return;
        const t = setTimeout(() => {
            if (points.length === 1) {
                map.flyTo([points[0].lat, points[0].lng], Math.max(map.getZoom(), 15), { duration: 0.8 });
                return;
            }
            const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
            map.flyToBounds(b, { paddingTopLeft: [padding[0], padding[1] + paddingTop], paddingBottomRight: [padding[0], padding[1] + paddingBottom], duration: 0.8, maxZoom: 16 });
        }, 60);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, paddingBottom, paddingTop]);
    return null;
}

function CenterOn({ center, zoom }: { center?: LatLng; zoom?: number }) {
    const map = useMap();
    const key = center ? `${center.lat.toFixed(5)},${center.lng.toFixed(5)}` : "";
    React.useEffect(() => {
        if (!center) return;
        map.flyTo([center.lat, center.lng], zoom ?? map.getZoom(), { duration: 0.7 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    return null;
}

function PinDropEvents({ onMove, onMoveStart }: { onMove?: (p: LatLng) => void; onMoveStart?: () => void }) {
    const map = useMapEvents({
        movestart: () => onMoveStart?.(),
        moveend: () => {
            const c = map.getCenter();
            onMove?.({ lat: c.lat, lng: c.lng });
        },
    });
    return null;
}

function Ready({ onReady }: { onReady?: (m: L.Map) => void }) {
    const map = useMap();
    React.useEffect(() => {
        onReady?.(map);
        // Leaflet needs a nudge after mounting in flex layouts
        const t = setTimeout(() => map.invalidateSize(), 150);
        return () => clearTimeout(t);
    }, [map, onReady]);
    return null;
}

function ResizeWatcher() {
    const map = useMap();
    React.useEffect(() => {
        const el = map.getContainer();
        const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
        ro.observe(el);
        return () => ro.disconnect();
    }, [map]);
    return null;
}

export default function MapView({
    className,
    center,
    zoom = DEFAULT_ZOOM,
    fitTo,
    fitPadding = [40, 40],
    paddingBottom = 0,
    paddingTop = 0,
    user,
    pickup,
    destination,
    stops = [],
    searching,
    route,
    routeTone = "ink",
    vehicles = [],
    driver,
    sos = [],
    pinDrop,
    onPinMove,
    onPinMoveStart,
    draggablePickup,
    onPickupDragEnd,
    interactive = true,
    onReady,
    children,
}: MapViewProps) {
    const initialCenter = center ?? pickup ?? user ?? DEFAULT_CENTER;
    const routeColor = routeTone === "brand" ? "#22a03d" : routeTone === "muted" ? "#a1a1aa" : "#0a0a0a";

    return (
        <div className={cn("relative isolate z-0 h-full w-full", className)}>
            <MapContainer
                center={[initialCenter.lat, initialCenter.lng]}
                zoom={zoom}
                zoomControl={false}
                attributionControl
                scrollWheelZoom={interactive}
                dragging={interactive}
                doubleClickZoom={interactive}
                touchZoom={interactive}
                className="h-full w-full"
                preferCanvas
            >
                <TileLayer url={TILE_URL} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={19} />
                <TileLayer url={TILE_URL_LABELS} subdomains="abcd" maxZoom={19} opacity={0.9} />
                <Ready onReady={onReady} />
                <ResizeWatcher />
                {center && !fitTo && <CenterOn center={center} zoom={zoom} />}
                {fitTo && <FitBounds points={fitTo} padding={fitPadding} paddingBottom={paddingBottom} paddingTop={paddingTop} />}
                {pinDrop && <PinDropEvents onMove={onPinMove} onMoveStart={onPinMoveStart} />}

                {route && route.length > 1 && (
                    <>
                        <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round" }} />
                        <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ color: routeColor, weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }} />
                    </>
                )}

                {user && <Marker position={[user.lat, user.lng]} icon={userIcon} interactive={false} zIndexOffset={50} />}

                {vehicles.map((v) => (
                    <Marker key={v.id} position={[v.pos.lat, v.pos.lng]} icon={vehicleIcon(v.code, { heading: v.heading, active: v.active, dim: v.dim })} interactive={false} zIndexOffset={v.active ? 400 : 100} />
                ))}

                {driver && <Marker position={[driver.lat, driver.lng]} icon={vehicleIcon(driver.code, { heading: driver.heading, active: true })} interactive={false} zIndexOffset={500} />}

                {stops.map((s, i) => (
                    <Marker key={`stop-${i}`} position={[s.lat, s.lng]} icon={stopIcon} interactive={false} zIndexOffset={200} />
                ))}

                {pickup && !pinDrop && (
                    <Marker
                        position={[pickup.lat, pickup.lng]}
                        icon={searching ? searchingIcon : pickupIcon}
                        draggable={!!draggablePickup}
                        zIndexOffset={300}
                        eventHandlers={
                            draggablePickup && onPickupDragEnd
                                ? {
                                    dragend: (e) => {
                                        const ll = (e.target as L.Marker).getLatLng();
                                        onPickupDragEnd({ lat: ll.lat, lng: ll.lng });
                                    },
                                }
                                : undefined
                        }
                    />
                )}
                {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} interactive={false} zIndexOffset={300} />}

                {sos.map((p, i) => (
                    <Marker key={`sos-${i}`} position={[p.lat, p.lng]} icon={sosIcon} interactive={false} zIndexOffset={600} />
                ))}
                {children}
            </MapContainer>

            {pinDrop && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[401] -translate-x-1/2 -translate-y-full" aria-hidden>
                    <div className="flex flex-col items-center">
                        <div className="rounded-lg bg-ink px-2.5 py-1 text-[11px] font-semibold text-white shadow-float">Pickup here</div>
                        <div className="h-2 w-[3px] bg-ink" />
                        <div className="h-7 w-7 rounded-full border-[5px] border-ink bg-white shadow-float" />
                        <div className="-mt-1 h-2 w-2 rounded-full bg-black/30 blur-[1px]" />
                    </div>
                </div>
            )}
        </div>
    );
}
