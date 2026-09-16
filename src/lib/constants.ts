import type { DriverStatus, Role, TripStatus, VehicleTypeCode } from "@/types";

export const APP_NAME = "GoRide";
export const APP_TAGLINE = "Your ride, on your terms.";

/** Default map centre: Colombo, Sri Lanka (currency LKR per SRS). */
export const DEFAULT_CENTER = { lat: 6.9271, lng: 79.8612 };
export const DEFAULT_ZOOM = 13;

/** Serviceable area (FR-RIDE-08): Greater Colombo bounding circle. */
export const SERVICE_AREA = { center: { lat: 6.9, lng: 79.9 }, radiusKm: 35 };

export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  register: "/register",
  callback: "/callback",
  forgot: "/forgot-password",
  verify: "/verify-email",
  dashboard: "/dashboard",
  rider: {
    home: "/rider",
    ride: "/rider/ride",
    trips: "/rider/trips",
    trip: (id: string) => `/rider/trips/${id}`,
    profile: "/rider/profile",
    contacts: "/rider/profile/emergency-contacts",
    notifications: "/rider/profile/notifications",
    payments: "/rider/payments",
  },
  driver: {
    home: "/driver",
    onboarding: "/driver/onboarding",
    earnings: "/driver/earnings",
    trips: "/driver/trips",
    trip: (id: string) => `/driver/trips/${id}`,
    profile: "/driver/profile",
    contacts: "/driver/profile/emergency-contacts",
  },
  admin: {
    home: "/admin",
    profile: "/admin/profile",
    drivers: "/admin/drivers",
    driver: (id: string) => `/admin/drivers/${id}`,
    sos: "/admin/sos",
    complaints: "/admin/complaints",
    trips: "/admin/trips",
    vehicleTypes: "/admin/vehicle-types",
    audit: "/admin/audit-log",
  },
} as const;

export function normalizeRole(role: unknown): Role {
  if (typeof role !== "string") return "Rider";
  const upper = role.toUpperCase();
  if (upper.includes("ADMIN")) return "Admin";
  if (upper.includes("DRIVER")) return "Driver";
  return "Rider";
}

export function homeForRole(role: Role) {
  return role === "Admin" ? ROUTES.admin.home : role === "Driver" ? ROUTES.driver.home : ROUTES.rider.home;
}

export function profileForRole(role: Role) {
  return role === "Admin"
    ? ROUTES.admin.profile
    : role === "Driver"
      ? ROUTES.driver.profile
      : ROUTES.rider.profile;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * /login, /signup and /logout are proxied to identity-auth via next.config.ts's
 * rewrites() (relative paths, same-origin — no more cross-origin cookies/CORS).
 * The backend still redirects back to whatever `returnUrl` it's given, verbatim,
 * so that part must stay an absolute URL or the browser ends up trying to load
 * a path off its own origin that doesn't exist there.
 */
function absoluteReturnUrl(returnUrl?: string) {
  if (!returnUrl) return undefined;
  return /^https?:\/\//i.test(returnUrl) ? returnUrl : `${APP_URL}${returnUrl.startsWith("/") ? "" : "/"}${returnUrl}`;
}

export function identityLoginUrl(returnUrl?: string) {
  const base = "/login";
  const absolute = absoluteReturnUrl(returnUrl);
  if (!absolute) return base;
  return `${base}?returnUrl=${encodeURIComponent(absolute)}`;
}

export function identitySignupUrl(returnUrl?: string) {
  const base = "/signup";
  const absolute = absoluteReturnUrl(returnUrl);
  if (!absolute) return base;
  return `${base}?returnUrl=${encodeURIComponent(absolute)}`;
}

export function identityLogoutUrl(returnUrl?: string) {
  const base = "/logout";
  const absolute = absoluteReturnUrl(returnUrl);
  if (!absolute) return base;
  return `${base}?returnUrl=${encodeURIComponent(absolute)}`;
}

/* ------------------------------------------------------------------ */
/* Trip status presentation                                             */
/* ------------------------------------------------------------------ */

export const TRIP_STATUS_META: Record<
  TripStatus,
  { label: string; tone: "neutral" | "brand" | "info" | "warning" | "danger" | "success"; riderHeadline: string }
> = {
  RIDE_DRAFT: { label: "Draft", tone: "neutral", riderHeadline: "Plan your ride" },
  FARE_ESTIMATED: { label: "Estimated", tone: "neutral", riderHeadline: "Choose a ride" },
  SEARCHING_DRIVER: { label: "Searching", tone: "info", riderHeadline: "Looking for nearby drivers" },
  REMATCHING: { label: "Re-matching", tone: "warning", riderHeadline: "Finding you another driver" },
  DRIVER_ASSIGNED: { label: "Driver assigned", tone: "brand", riderHeadline: "Driver confirmed" },
  DRIVER_EN_ROUTE: { label: "Driver en route", tone: "brand", riderHeadline: "Your driver is on the way" },
  DRIVER_ARRIVED: { label: "Driver arrived", tone: "success", riderHeadline: "Your driver has arrived" },
  TRIP_IN_PROGRESS: { label: "In progress", tone: "info", riderHeadline: "Heading to your destination" },
  TRIP_COMPLETED: { label: "Completed", tone: "success", riderHeadline: "You've arrived" },
  PAYMENT_PENDING: { label: "Payment pending", tone: "warning", riderHeadline: "Complete your payment" },
  PAID: { label: "Paid", tone: "success", riderHeadline: "Payment received" },
  CLOSED: { label: "Closed", tone: "neutral", riderHeadline: "Trip closed" },
  NO_DRIVER_FOUND: { label: "No driver found", tone: "danger", riderHeadline: "No drivers available right now" },
  CANCELLED: { label: "Cancelled", tone: "danger", riderHeadline: "Trip cancelled" },
};

export const ACTIVE_TRIP_STATUSES: TripStatus[] = [
  "SEARCHING_DRIVER",
  "REMATCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_EN_ROUTE",
  "DRIVER_ARRIVED",
  "TRIP_IN_PROGRESS",
  "TRIP_COMPLETED",
  "PAYMENT_PENDING",
];

export const TERMINAL_TRIP_STATUSES: TripStatus[] = ["PAID", "CLOSED", "CANCELLED", "NO_DRIVER_FOUND"];

export const DRIVER_STATUS_META: Record<DriverStatus, { label: string; tone: "neutral" | "brand" | "info" | "warning" | "danger" | "success" }> = {
  PendingVerification: { label: "Pending verification", tone: "warning" },
  DocumentReview: { label: "Under review", tone: "info" },
  Active: { label: "Active", tone: "success" },
  Rejected: { label: "Rejected", tone: "danger" },
  Suspended: { label: "Suspended", tone: "warning" },
  Deactivated: { label: "Deactivated", tone: "danger" },
  Offline: { label: "Offline", tone: "neutral" },
};

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

export const VEHICLE_IMAGES: Record<string, string> = {
  BIKE: "/vehicles/bike.webp",
  TUK: "/vehicles/tuk.webp",
  TUKTUK: "/vehicles/tuk.webp",
  CAR: "/vehicles/car.png",
  XL: "/vehicles/car.png",
};

export const CANCEL_REASONS_RIDER = [
  "Driver is taking too long",
  "Changed my plans",
  "Booked by mistake",
  "Found another ride",
  "Driver asked me to cancel",
  "Other",
];

export const CANCEL_REASONS_DRIVER = [
  "Rider not at pickup",
  "Rider asked to cancel",
  "Vehicle issue",
  "Pickup too far / traffic",
  "Unsafe pickup location",
  "Other",
];

export const COMPLAINT_CATEGORIES = [
  "Driver behaviour",
  "Rider behaviour",
  "Route / detour",
  "Fare / payment",
  "Vehicle condition",
  "Safety concern",
  "Other",
];

/** Matching round timings (seconds) used by the mock simulation & UI copy. */
export const MATCH_ROUNDS = [
  { round: 1, radiusKm: 2, seconds: 7 },
  { round: 2, radiusKm: 5, seconds: 7 },
  { round: 3, radiusKm: 10, seconds: 7 },
] as const;

export const DRIVER_OFFER_TTL_SECONDS = 20;
export const RIDER_NO_SHOW_WAIT_MIN = 5;

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
