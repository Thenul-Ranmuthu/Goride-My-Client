import L from "leaflet";
import type { VehicleTypeCode } from "@/types";
import { VEHICLE_IMAGES } from "@/lib/constants";

/** Pickup: white disc with a thick black ring (theme's "find a trip" rail dot). */
export const pickupIcon = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:9999px;background:#fff;border:4px solid #0a0a0a;box-shadow:0 2px 8px rgba(0,0,0,.25)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

/** Destination: black rounded square (theme's rail end). */
export const destinationIcon = L.divIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:4px;background:#fff;border:4px solid #0a0a0a;box-shadow:0 2px 8px rgba(0,0,0,.25)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

export const stopIcon = L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:9999px;background:#0a0a0a;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

/** Rider's own position — blue dot with soft pulse. */
export const userIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:22px;height:22px">
    <span style="position:absolute;inset:-10px;border-radius:9999px;background:rgba(37,99,235,.18);animation:radar 2s ease-out infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></span>
  </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
});

/** Pickup with radar pulse while searching for drivers. */
export const searchingIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:18px;height:18px">
    <span style="position:absolute;inset:-70px;border-radius:9999px;background:rgba(82,213,106,.22);animation:radar 2s cubic-bezier(.22,1,.36,1) infinite"></span>
    <span style="position:absolute;inset:-70px;border-radius:9999px;background:rgba(82,213,106,.22);animation:radar 2s cubic-bezier(.22,1,.36,1) .7s infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:#fff;border:4px solid #0a0a0a;box-shadow:0 2px 8px rgba(0,0,0,.25)"></span>
  </div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
});

const vehicleIconCache = new Map<string, L.DivIcon>();

/** Vehicle marker — white puck with the theme's vehicle render + heading tick. */
export function vehicleIcon(code: VehicleTypeCode, opts?: { heading?: number; active?: boolean; dim?: boolean }) {
    const heading = Math.round((opts?.heading ?? 0) / 10) * 10;
    const key = `${code}|${heading}|${opts?.active ? 1 : 0}|${opts?.dim ? 1 : 0}`;
    const cached = vehicleIconCache.get(key);
    if (cached) return cached;
    const size = opts?.active ? 46 : 34;
    const img = VEHICLE_IMAGES[code];
    const ring = opts?.active ? "0 0 0 3px #52d56a, 0 6px 18px rgba(0,0,0,.3)" : "0 3px 10px rgba(0,0,0,.22)";
    const html = `<div class="goride-vehicle" style="position:relative;width:${size}px;height:${size}px;opacity:${opts?.dim ? 0.75 : 1}">
    <span style="position:absolute;inset:0;border-radius:9999px;background:#fff;box-shadow:${ring};display:flex;align-items:center;justify-content:center;overflow:hidden">
      <img src="${img}" alt="" style="width:${Math.round(size * 0.78)}px;height:auto;object-fit:contain;mix-blend-mode:multiply" draggable="false"/>
    </span>
    ${opts?.active ? `<span style="position:absolute;left:50%;top:50%;width:0;height:0;transform:translate(-50%,-50%) rotate(${heading}deg) translateY(-${size / 2 + 6}px);border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid #0a0a0a"></span>` : ""}
  </div>`;
    const icon = L.divIcon({ className: "goride-smooth", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    vehicleIconCache.set(key, icon);
    return icon;
}

/** SOS incident marker for the admin map. */
export const sosIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:26px;height:26px">
    <span style="position:absolute;inset:-16px;border-radius:9999px;background:rgba(220,38,38,.25);animation:radar 1.6s ease-out infinite"></span>
    <span style="position:absolute;inset:0;border-radius:9999px;background:#dc2626;border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 11px/1 Poppins,sans-serif">!</span>
  </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
});
