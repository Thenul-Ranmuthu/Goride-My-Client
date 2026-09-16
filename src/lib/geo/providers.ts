/**
 * Maps / geocoding / routing providers.
 *
 * The SRS (§6.3) allows a third-party provider "or a reasonable mock of one".
 * We use free OSM services when reachable and fall back to local data so the
 * app is always demoable offline:
 *   • Places search  → Nominatim (Sri Lanka-bounded) + local landmark list
 *   • Reverse geocode → Nominatim + nearest local landmark
 *   • Routing        → OSRM demo server + synthetic curve fallback
 */
import type { LatLng, Place } from "@/types";
import { PLACES } from "@/lib/mock/seed";
import { SERVICE_AREA } from "@/lib/constants";
import { haversineKm, pathLengthKm, syntheticRoute } from "@/lib/utils";
import { estimateDurationMin } from "@/lib/mock/seed";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OSRM = "https://router.project-osrm.org";
const ONLINE_PROVIDERS = process.env.NEXT_PUBLIC_GEO_PROVIDERS !== "offline";

function localSearch(query: string, limit = 6): Place[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PLACES.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)).slice(0, limit);
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: Record<string, string>;
}

function toPlace(r: NominatimResult): Place {
  const parts = r.display_name.split(",").map((s) => s.trim());
  const name = r.name || parts[0];
  const address = parts.slice(0, 4).join(", ");
  return { name, address, lat: parseFloat(r.lat), lng: parseFloat(r.lon) };
}

let searchAbort: AbortController | null = null;

export async function searchPlaces(query: string): Promise<Place[]> {
  const local = localSearch(query);
  if (!ONLINE_PROVIDERS || query.trim().length < 3) return local;
  try {
    searchAbort?.abort();
    searchAbort = new AbortController();
    const url = `${NOMINATIM}/search?format=jsonv2&limit=6&countrycodes=lk&viewbox=79.75,7.15,80.15,6.70&bounded=0&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: searchAbort.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return local;
    const data = (await res.json()) as NominatimResult[];
    const remote = data.map(toPlace);
    // de-dupe against local by proximity
    const merged = [...local];
    for (const r of remote) {
      if (!merged.some((m) => haversineKm(m, r) < 0.15)) merged.push(r);
    }
    return merged.slice(0, 8);
  } catch {
    return local;
  }
}

export async function reverseGeocode(pos: LatLng): Promise<Place> {
  const nearest = [...PLACES].sort((a, b) => haversineKm(a, pos) - haversineKm(b, pos))[0];
  const nearestKm = haversineKm(nearest, pos);
  if (!ONLINE_PROVIDERS) return fallbackPlace(pos, nearest, nearestKm);
  try {
    const url = `${NOMINATIM}/reverse?format=jsonv2&lat=${pos.lat}&lon=${pos.lng}&zoom=17`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return fallbackPlace(pos, nearest, nearestKm);
    const r = (await res.json()) as NominatimResult;
    if (!r?.display_name) return fallbackPlace(pos, nearest, nearestKm);
    const p = toPlace(r);
    return { ...p, lat: pos.lat, lng: pos.lng };
  } catch {
    return fallbackPlace(pos, nearest, nearestKm);
  }
}

function fallbackPlace(pos: LatLng, nearest: Place, km: number): Place {
  if (km < 0.35) return { ...nearest, lat: pos.lat, lng: pos.lng };
  return { name: "Pinned location", address: `Near ${nearest.name}`, lat: pos.lat, lng: pos.lng };
}

export interface RouteResult {
  geometry: LatLng[];
  distanceKm: number;
  durationMin: number;
}

export async function getRoute(points: LatLng[]): Promise<RouteResult> {
  const fallback = (): RouteResult => {
    const geometry: LatLng[] = [];
    for (let i = 0; i < points.length - 1; i++) geometry.push(...syntheticRoute(points[i], points[i + 1], 18));
    const distanceKm = Math.round(pathLengthKm(geometry) * 1.15 * 10) / 10;
    return { geometry, distanceKm, durationMin: estimateDurationMin(distanceKm) };
  };
  if (!ONLINE_PROVIDERS || points.length < 2) return fallback();
  try {
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const res = await fetch(`${OSRM}/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    if (!res.ok) return fallback();
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return fallback();
    const geometry: LatLng[] = route.geometry.coordinates.map((c: [number, number]) => ({ lat: c[1], lng: c[0] }));
    const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
    // OSRM demo durations are optimistic for Colombo traffic — calibrate up a touch
    const durationMin = Math.max(3, Math.round((route.duration / 60) * 1.35));
    return { geometry, distanceKm, durationMin };
  } catch {
    return fallback();
  }
}

export function isInsideServiceArea(p: LatLng) {
  return haversineKm(p, SERVICE_AREA.center) <= SERVICE_AREA.radiusKm;
}

/** Browser geolocation wrapped in a promise with a sane Colombo fallback. */
export function getCurrentPosition(timeoutMs = 6000): Promise<{ pos: LatLng; source: "gps" | "fallback" }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ pos: PLACES[0], source: "fallback" });
      return;
    }
    const timer = setTimeout(() => resolve({ pos: PLACES[0], source: "fallback" }), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        // Demo safety: if the browser is outside the service area, snap to Colombo
        resolve(isInsideServiceArea(pos) ? { pos, source: "gps" } : { pos: PLACES[0], source: "fallback" });
      },
      () => {
        clearTimeout(timer);
        resolve({ pos: PLACES[0], source: "fallback" });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}
