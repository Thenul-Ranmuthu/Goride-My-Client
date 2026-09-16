import type {
  DriverProfile,
  FareOption,
  Session,
  User,
  VehicleTypeCode,
} from "@/types";
import { useAuthStore } from "@/lib/auth/session";
import { normalizeRole } from "@/lib/constants";
import type { FareEstimate, GoRideApi, Trip } from "./contract";
import { httpApi } from "./http";
import { mockApi } from "@/lib/mock/api";

// identity-auth calls (/api/*, /login, /logout, ...) go through next.config.ts's
// rewrites() as relative, same-origin paths — no NEXT_PUBLIC_API_URL / CORS
// needed for them. Trip-matching is a separate, non-proxied backend, so it
// still needs its own absolute URL.
const TRIP_API_URL =
  process.env.NEXT_PUBLIC_TRIP_API_URL ?? "http://localhost:8080";

export const API_MODE: "mock" | "http" =
  process.env.NEXT_PUBLIC_API_MODE === "http" ? "http" : "mock";
export const IS_MOCK = API_MODE === "mock";

export type {
  GoRideApi,
  TripEvent,
  RegisterPayload,
  CreateTripPayload,
  DriverTripAction,
} from "./contract";

export interface AdminDriverActivity {
  driverId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleTypeCode: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: number;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAuditLog {
  id: string;
  actorId: string;
  action: number;
  targetId: string;
  timeStampUtc: string;
}

export interface InternalUser {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  roles: string[];
}

export function errorMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (
    e &&
    typeof e === "object" &&
    "message" in e &&
    typeof (e as Error).message === "string"
  )
    return (e as Error).message;
  return fallback;
}

/* ------------------------------------------------------------------ */
/* Fare estimation — Trip-Matching microservice                         */
/* ------------------------------------------------------------------ */

/**
 * Calls goride-trip-matching service's POST /fare/estimate endpoint.
 * Returns FareOption[] with displayName (TUKTUK -> "Tuk Tuk", etc.)
 * and availability (only TUKTUK available in current stage).
 */
export async function estimateFares(
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<FareOption[]> {
  const baseUrl = (TRIP_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

  const res = await fetch(`${baseUrl}/fare/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startLat: pickup.lat,
      startLng: pickup.lng,
      endLat: destination.lat,
      endLng: destination.lng,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Fare estimate failed (${res.status})${text ? `: ${text}` : ""}`,
    );
  }

  const raw = (await res.json()) as {
    vehicleTypeId: string;
    vehicleTypeCode: string;
    displayName: string;
    available: boolean;
    fare: number;
    distanceKm: number;
    estimatedDurationMinutes: number;
  }[];

  return raw.map((r) => ({
    vehicleTypeId: r.vehicleTypeId,
    vehicleTypeCode: (r.vehicleTypeCode === "TUKTUK"
      ? "TUK"
      : r.vehicleTypeCode) as FareOption["vehicleTypeCode"],
    displayName:
      r.displayName ||
      (r.vehicleTypeCode === "TUKTUK" || r.vehicleTypeCode === "TUK"
        ? "Tuk Tuk"
        : r.vehicleTypeCode),
    available: r.available,
    fare: r.fare,
    distanceKm: r.distanceKm,
    estimatedDurationMinutes: r.estimatedDurationMinutes,
  }));
}

/**
 * Adapter that connects trip estimation directly to the goride-trip-matching backend.
 */
function createTripApi(): GoRideApi {
  const base = IS_MOCK ? mockApi : httpApi;

  return {
    ...base,
    trips: {
      ...base.trips,
      async estimate(tripId: string): Promise<FareEstimate[]> {
        let trip: Trip | null = null;
        try {
          trip = await base.trips.get(tripId);
        } catch {
          // ignore
        }

        if (trip?.pickup && trip?.destination) {
          try {
            // Call the real goride-trip-matching backend
            const backendOptions = await estimateFares(
              trip.pickup,
              trip.destination,
            );
            if (backendOptions.length > 0) {
              return backendOptions.map((opt) => {
                const code = (
                  opt.vehicleTypeCode === "TUKTUK" ? "TUK" : opt.vehicleTypeCode
                ) as VehicleTypeCode;
                const isAvailable =
                  opt.available &&
                  (opt.vehicleTypeCode === "TUKTUK" ||
                    opt.vehicleTypeCode === "TUK");
                return {
                  vehicleTypeId: opt.vehicleTypeId,
                  vehicleTypeCode: code,
                  estimatedFare: opt.fare,
                  distanceKm: opt.distanceKm,
                  durationMin: opt.estimatedDurationMinutes,
                  etaMin: isAvailable ? 3 : 0,
                  breakdown: {
                    base: Math.round(opt.fare * 0.35),
                    distance: Math.round(opt.fare * 0.5),
                    time: Math.round(opt.fare * 0.15),
                    stops: 0,
                    waiting: 0,
                    total: opt.fare,
                  },
                };
              });
            }
          } catch (err) {
            console.warn(
              "[goride-trip-matching] live estimate failed, falling back to local calculation",
              err,
            );
          }
        }

        // Fallback: calculate using base logic while enforcing only TUKTUK is allowed
        const estimates = await base.trips.estimate(tripId);
        return estimates;
      },
    },
  };
}

export const api: GoRideApi = createTripApi();

/* ------------------------------------------------------------------ */
/* Identity & Auth integration (goride-identity-auth)                   */
/* ------------------------------------------------------------------ */

export interface MeResponse {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  roles: string[];
}

export type DriverVehiclePayload = {
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleTypeCode: VehicleTypeCode;
  licenseNumber: string;
  licenseExpiry: string;
};

function readStringValue(
  raw: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      const nested = readStringValue(
        candidate,
        ["value", "status", "name"],
        "",
      );
      if (nested) return nested;
    }
  }
  return fallback;
}

function readBooleanValue(
  raw: Record<string, unknown>,
  keys: string[],
  fallback = false,
): boolean {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true") return true;
      if (lower === "false") return false;
    }
    if (value && typeof value === "object") {
      const candidate = value as Record<string, unknown>;
      const nested = readBooleanValue(
        candidate,
        ["value", "enabled", "is_active"],
        fallback,
      );
      if (nested !== fallback || Object.hasOwn(candidate, "value"))
        return nested;
    }
  }
  return fallback;
}

function normalizeDriverStatus(status: unknown): DriverProfile["status"] {
  const raw =
    typeof status === "string"
      ? status
      : status && typeof status === "object"
        ? (status as Record<string, unknown>)
        : null;
  const candidate = raw
    ? readStringValue(
        raw as Record<string, unknown>,
        ["value", "status", "name"],
        "PendingVerification",
      )
    : "PendingVerification";
  const normalized = candidate.trim();
  const valid = [
    "PendingVerification",
    "DocumentReview",
    "Active",
    "Rejected",
    "Suspended",
    "Deactivated",
    "Offline",
  ] as const;
  return valid.includes(normalized as (typeof valid)[number])
    ? (normalized as DriverProfile["status"])
    : "PendingVerification";
}

function normalizeDriverProfile(
  raw: Record<string, unknown>,
  fallbackDriverId?: string,
): DriverProfile {
  const vehicleTypeCode = readStringValue(
    raw,
    ["vehicle_type_code", "vehicleTypeCode"],
    "CAR",
  ) as DriverProfile["vehicleTypeCode"];
  const safeVehicleTypeCode = ["BIKE", "TUK", "CAR", "XL"].includes(
    vehicleTypeCode,
  )
    ? vehicleTypeCode
    : "CAR";

  return {
    driverId: readStringValue(
      raw,
      ["driver_id", "driverId"],
      fallbackDriverId ?? "",
    ),
    vehicleMake: readStringValue(raw, ["vehicle_make", "vehicleMake"], ""),
    vehicleModel: readStringValue(raw, ["vehicle_model", "vehicleModel"], ""),
    vehiclePlate: readStringValue(raw, ["vehicle_plate", "vehiclePlate"], ""),
    vehicleColor: readStringValue(raw, ["vehicle_color", "vehicleColor"], ""),
    vehicleTypeCode: safeVehicleTypeCode,
    licenseNumber: readStringValue(
      raw,
      ["license_number", "licenseNumber"],
      "",
    ),
    licenseExpiry: readStringValue(
      raw,
      ["license_expiry", "licenseExpiry"],
      new Date().toISOString(),
    ),
    status: normalizeDriverStatus(
      raw.status ??
        raw.profileStatus ??
        raw.statusValue ??
        "PendingVerification",
    ),
    verifiedAt: readStringValue(raw, ["verified_at", "verifiedAt"], "") || null,
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    online: readBooleanValue(raw, ["online", "is_online"], false),
  };
}

function driverProfileFromResponse(
  response: Partial<DriverProfile> | null,
  values: DriverVehiclePayload,
): DriverProfile {
  const parsed = (response ?? {}) as Record<string, unknown>;
  const normalized = {
    ...parsed,
    driverId: parsed.driverId ?? parsed.driver_id ?? "",
    vehicleMake:
      parsed.vehicleMake ?? parsed.vehicle_make ?? values.vehicleMake,
    vehicleModel:
      parsed.vehicleModel ?? parsed.vehicle_model ?? values.vehicleModel,
    vehiclePlate:
      parsed.vehiclePlate ?? parsed.vehicle_plate ?? values.vehiclePlate,
    vehicleColor: parsed.vehicleColor ?? parsed.vehicle_color ?? "",
    vehicleTypeCode: (parsed.vehicleTypeCode ??
      parsed.vehicle_type_code ??
      values.vehicleTypeCode) as DriverProfile["vehicleTypeCode"],
    licenseNumber:
      parsed.licenseNumber ?? parsed.license_number ?? values.licenseNumber,
    licenseExpiry:
      parsed.licenseExpiry ?? parsed.license_expiry ?? values.licenseExpiry,
    status:
      parsed.status ??
      parsed.profileStatus ??
      parsed.statusValue ??
      "PendingVerification",
    verifiedAt: parsed.verifiedAt ?? parsed.verified_at ?? null,
    online: parsed.online ?? parsed.is_online ?? false,
  };

  return normalizeDriverProfile(normalized, values.vehiclePlate);
}

async function driverProfileRequest(
  url: string,
  values: DriverVehiclePayload,
  method: "POST" | "PUT" = "POST",
): Promise<DriverProfile> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values),
  });

  if (!res.ok) throw new Error("Failed to save vehicle details");

  const text = await res.text();
  const response = text ? (JSON.parse(text) as Partial<DriverProfile>) : null;
  return driverProfileFromResponse(response, values);
}

export function addDriverProfile(
  values: DriverVehiclePayload,
): Promise<DriverProfile> {
  return driverProfileRequest(`/api/driver/addProfile`, values, "POST");
}

export function updateDriverProfile(
  sub: string,
  values: DriverVehiclePayload,
): Promise<DriverProfile> {
  return driverProfileRequest(`/api/driver/update/${sub}`, values, "PUT");
}

function buildSessionFromMe(me: MeResponse): Session {
  const primaryRole =
    (me.roles.map((value) => normalizeRole(value)).find(Boolean) as
      | User["role"]
      | undefined) ?? "Rider";

  const user: User = {
    id: me.userId,
    name: me.name,
    email: me.email,
    phone: me.phone,
    role: primaryRole,
    emailVerified: true,
    phoneVerified: false,
    rating: 5,
    ratingCount: 0,
    createdAt: new Date().toISOString(),
  };

  return {
    user,
    accessToken: "",
    expiresAt: Date.now() + 60 * 60 * 1000,
    provider: "oidc",
  };
}

async function fetchMe(sub?: string): Promise<MeResponse | null> {
  const session = useAuthStore.getState().session;
  if (!sub && session?.provider === "local") {
    return {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone ?? null,
      roles: [session.user.role],
    };
  }

  const query = sub ? `?sub=${encodeURIComponent(sub)}` : "";
  const res = await fetch(`/api/me${query}`, {
    cache: "no-store",
  });

  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch user");

  const raw = (await res.json()) as MeResponse & {
    phoneNumber?: string | null;
    phone_number?: string | null;
  };
  const me: MeResponse = {
    ...raw,
    phone: raw.phone ?? raw.phoneNumber ?? raw.phone_number ?? null,
  };
  if (!sub) useAuthStore.getState().setSession(buildSessionFromMe(me));
  return me;
}

export function getMe(): Promise<MeResponse | null> {
  return fetchMe();
}

export async function getInternalUser(
  sub: string,
): Promise<InternalUser | null> {
  const res = await fetch(`/api/internal-users/${encodeURIComponent(sub)}`, {
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch internal user");

  const raw = (await res.json()) as {
    id: string;
    userName?: string;
    emails?: { value?: string }[] | string[];
    phoneNumbers?: { value?: string }[];
    roles?: { display?: string }[];
  };

  return {
    id: raw.id,
    username: (raw.userName ?? "").replace(/^DEFAULT\//, ""),
    email: raw.emails?.[0]
      ? typeof raw.emails[0] === "string"
        ? raw.emails[0]
        : (raw.emails[0].value ?? null)
      : null,
    phone: raw.phoneNumbers?.[0]?.value ?? null,
    roles:
      raw.roles
        ?.map((role) => role.display)
        .filter((role): role is string => Boolean(role)) ?? [],
  };
}

export async function getAdminActivity(): Promise<AdminDriverActivity[]> {
  const res = await fetch("/api/adminActivity", { cache: "no-store" });
  if (res.status === 401 || res.status === 403) return [];
  if (!res.ok) throw new Error("Failed to fetch driver activity");
  return (await res.json()) as AdminDriverActivity[];
}

export async function getAdminAuditLogs(): Promise<AdminAuditLog[]> {
  const res = await fetch("/api/adminActivity/getLogs", { cache: "no-store" });
  if (res.status === 401 || res.status === 403) return [];
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return (await res.json()) as AdminAuditLog[];
}

export async function updateAdminDriverStatus(
  driverSub: string,
  statusNum: number,
): Promise<void> {
  const res = await fetch(
    `/api/adminActivity/${encodeURIComponent(driverSub)}/${statusNum}`,
    {
      method: "PUT",
    },
  );
  if (!res.ok) throw new Error("Failed to update driver status");
}

export async function getDriverProfile(
  sub: string,
): Promise<DriverProfile | null> {
  const res = await fetch(`/api/driver/${sub}`);

  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch driver profile");

  const text = await res.text();
  const payload = text
    ? (JSON.parse(text) as Partial<DriverProfile> & Record<string, unknown>)
    : null;
  return payload ? normalizeDriverProfile(payload, sub) : null;
}

export async function selectRole(role: "Driver" | "Rider"): Promise<void> {
  const res = await fetch(`/api/onboarding/select-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });

  if (!res.ok) throw new Error("Failed to assign role");
}

export async function updatePhoneNumber(
  phoneNumber: string,
): Promise<string | null> {
  const res = await fetch(`/api/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });

  if (!res.ok) throw new Error("Failed to update phone number");

  const text = await res.text();
  if (!text) return phoneNumber;

  const response = (await JSON.parse(text)) as {
    phone?: string | null;
    phoneNumber?: string | null;
  };
  return response.phone ?? response.phoneNumber ?? phoneNumber;
}
