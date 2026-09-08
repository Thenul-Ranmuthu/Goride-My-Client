/**
 * GoRide domain types.
 *
 * These mirror the per-service schemas in the Microservice Design Document
 * (Identity & Auth) so the frontend can be pointed at the real gateway
 * without reshaping data.
 */

export type Role = "Rider" | "Driver" | "Admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  profilePhotoUrl?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  rating: number; // DECIMAL(3,2) default 5.00
  ratingCount: number;
  deactivatedAt?: string | null;
  createdAt: string;
}

export type DriverStatus =
  | "PendingVerification"
  | "DocumentReview"
  | "Active"
  | "Rejected"
  | "Suspended"
  | "Deactivated"
  | "Offline";

export type VehicleTypeCode = "BIKE" | "TUK" | "CAR" | "XL";

export interface DriverProfile {
  driverId: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  vehicleColor?: string;
  vehicleTypeCode: VehicleTypeCode;
  licenseNumber: string;
  licenseExpiry: string; // ISO date
  status: DriverStatus;
  verifiedAt?: string | null;
  online: boolean;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship?: string;
  phone: string;
  email?: string;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                 */
/* ------------------------------------------------------------------ */

export interface Session {
  user: User;
  accessToken: string;
  expiresAt: number;
  provider: "local" | "oidc";
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "Rider" | "Driver";
  vehicle?: {
    make: string;
    model: string;
    plate: string;
    color: string;
    typeCode: VehicleTypeCode;
    licenseNumber: string;
    licenseExpiry: string;
  };
}
