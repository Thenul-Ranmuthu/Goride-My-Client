import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { LatLng } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

const lkr = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 0 });
const lkrCents = new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Currency is LKR per the SRS. "Rs 1,250" — PickMe-style. */
export function formatLKR(amount: number | null | undefined, opts?: { cents?: boolean }) {
  if (amount == null || Number.isNaN(amount)) return "Rs —";
  return `Rs ${opts?.cents ? lkrCents.format(amount) : lkr.format(Math.round(amount))}`;
}

export function formatKm(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatMinutes(min: number) {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function formatTime(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-GB", opts ?? { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string | Date) {
  return `${formatDate(iso, { day: "numeric", month: "short" })} · ${formatTime(iso)}`;
}

export function relativeDay(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return "Earlier";
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86_400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86_400)} d ago`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function maskPlate(plate: string) {
  return plate.toUpperCase();
}

export function splitAddress(address: string): { primary: string; secondary: string } {
  const [primary, ...rest] = address.split(",").map((s) => s.trim());
  return { primary: primary ?? address, secondary: rest.join(", ") };
}

/* ------------------------------------------------------------------ */
/* Geo helpers                                                          */
/* ------------------------------------------------------------------ */

const R = 6371; // km

export function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearing(a: LatLng, b: LatLng) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const toDeg = (x: number) => (x * 180) / Math.PI;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Point along a polyline at fraction t ∈ [0,1] of its total length. */
export function pointAlong(path: LatLng[], t: number): { point: LatLng; heading: number } {
  if (path.length === 0) return { point: { lat: 0, lng: 0 }, heading: 0 };
  if (path.length === 1) return { point: path[0], heading: 0 };
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = haversineKm(path[i], path[i + 1]);
    segs.push(d);
    total += d;
  }
  let target = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i] || i === segs.length - 1) {
      const f = segs[i] === 0 ? 0 : target / segs[i];
      const p = { lat: lerp(path[i].lat, path[i + 1].lat, f), lng: lerp(path[i].lng, path[i + 1].lng, f) };
      return { point: p, heading: bearing(path[i], path[i + 1]) };
    }
    target -= segs[i];
  }
  return { point: path[path.length - 1], heading: 0 };
}

export function pathLengthKm(path: LatLng[]) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += haversineKm(path[i], path[i + 1]);
  return total;
}

/** Smooth, plausible route between two points when no routing provider is reachable. */
export function syntheticRoute(a: LatLng, b: LatLng, points = 24): LatLng[] {
  const out: LatLng[] = [];
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  // perpendicular offset for a gentle curve + small dog-legs to read like streets
  const px = -dy;
  const py = dx;
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const curve = Math.sin(t * Math.PI) * 0.12;
    const jitter = (i % 4 === 0 ? 0.02 : i % 4 === 2 ? -0.02 : 0) * Math.sin(t * Math.PI);
    out.push({ lat: a.lat + dy * t + py * (curve + jitter), lng: a.lng + dx * t + px * (curve + jitter) });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Misc                                                                 */
/* ------------------------------------------------------------------ */

export function uid(prefix = "") {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function isBrowser() {
  return typeof window !== "undefined";
}
