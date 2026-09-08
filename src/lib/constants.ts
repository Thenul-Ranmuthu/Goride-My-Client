import type { Role, VehicleTypeCode } from "@/types";

export const APP_NAME = "GoRide";
export const APP_TAGLINE = "Your ride, on your terms.";

export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  dashboard: "/dashboard",
  rider: { profile: "/rider/profile" },
  driver: { profile: "/driver/profile" },
  admin: { profile: "/admin/profile" },
} as const;

export function identityLoginUrl(returnTo?: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://localhost:7136";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const target = returnTo
    ? `${appUrl}${returnTo.startsWith("/") ? returnTo : `/${returnTo}`}`
    : `${appUrl}/dashboard`;

  return `${apiUrl}/login?returnUrl=${encodeURIComponent(target)}`;
}

/**
 * Where a user lands after signing in. Every role currently shares one
 * dashboard that renders per role — split the cases when they diverge.
 */
export function normalizeRole(role?: string | null): Role | null {
  const value = role?.trim();
  if (!value) return null;

  const lowered = value.toLowerCase();
  if (lowered === "driver") return "Driver";
  if (lowered === "rider") return "Rider";
  if (lowered === "admin") return "Admin";
  return null;
}

export function homeForRole(role?: Role) {
  switch (role) {
    case "Driver":
    case "Admin":
    case "Rider":
    default:
      return ROUTES.dashboard;
  }
}

export function profileForRole(role: Role) {
  return role === "Admin"
    ? ROUTES.admin.profile
    : role === "Driver"
      ? ROUTES.driver.profile
      : ROUTES.rider.profile;
}

/* ------------------------------------------------------------------ */
/* Vehicles                                                             */
/* ------------------------------------------------------------------ */

export const VEHICLE_TYPES: {
  code: VehicleTypeCode;
  name: string;
  seats: number;
}[] = [
  { code: "BIKE", name: "Bike", seats: 1 },
  { code: "TUK", name: "Tuk", seats: 3 },
  { code: "CAR", name: "Car", seats: 4 },
  { code: "XL", name: "XL", seats: 6 },
];

export const VEHICLE_IMAGES: Record<VehicleTypeCode, string> = {
  BIKE: "/vehicles/bike.webp",
  TUK: "/vehicles/tuk.webp",
  CAR: "/vehicles/car.png",
  XL: "/vehicles/car.png",
};

/* ------------------------------------------------------------------ */
/* Demo accounts (seeded into the local identity store)                 */
/* ------------------------------------------------------------------ */

export const DEMO_ACCOUNTS = [
  {
    role: "Rider" as const,
    email: "rider@goride.lk",
    name: "Nimali Perera",
    hint: "Book & track a ride",
  },
  {
    role: "Driver" as const,
    email: "driver@goride.lk",
    name: "Kasun Fernando",
    hint: "Go online, accept rides",
  },
  {
    role: "Admin" as const,
    email: "admin@goride.lk",
    name: "Shageeshan T",
    hint: "Verify drivers, SOS, audit",
  },
];

export const DEMO_PASSWORD = "goride123";
