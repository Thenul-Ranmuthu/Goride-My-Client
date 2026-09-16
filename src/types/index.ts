/**
 * GoRide domain types.
 *
 * These mirror the per-service schemas in the Microservice Design Document
 * (Identity & Auth · Location & Notification · Trip & Matching · Payment & Fare)
 * so the frontend can be pointed at the real gateway without reshaping data.
 */

/* ------------------------------------------------------------------ */
/* Identity & Auth                                                      */
/* ------------------------------------------------------------------ */

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
  paymentMethodToken?: string | null;
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
  documents: DriverDocument[];
  /** Availability is the Offline/Active toggle; kept separately for clarity in the UI. */
  online: boolean;
}

export type DocumentKind = "DrivingLicence" | "VehicleRegistration" | "Insurance" | "NIC";
export type DocumentStatus = "Missing" | "Uploaded" | "Approved" | "Rejected";

export interface DriverDocument {
  id: string;
  kind: DocumentKind;
  fileName?: string;
  uploadedAt?: string;
  status: DocumentStatus;
  note?: string;
}

export interface Driver extends User {
  role: "Driver";
  profile: DriverProfile;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship?: string;
  phone: string;
  email?: string;
}

export type AdminActionType = "Approve" | "Reject" | "Suspend" | "Deactivate" | "Reactivate";

export interface AdminAction {
  id: string;
  adminId: string;
  adminName: string;
  targetType: "Driver" | "Rider";
  targetId: string;
  targetName: string;
  action: AdminActionType | "ResolveSOS" | "ResolveComplaint" | "ResolveDispute" | "UpdateRates";
  reason: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Location & Notification                                              */
/* ------------------------------------------------------------------ */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DriverLocation extends LatLng {
  driverId: string;
  heading: number; // degrees
  status: "Online" | "Offline" | "OnTrip";
  lastUpdated: string;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

export type NotificationChannel = "Push" | "Email" | "SMS";

export interface AppNotification {
  id: string;
  userId: string;
  tripId?: string | null;
  channel: NotificationChannel;
  template: string;
  title: string;
  message: string;
  status: "Sent" | "Failed";
  read: boolean;
  sentAt: string;
}

/* ------------------------------------------------------------------ */
/* Trip & Matching                                                      */
/* ------------------------------------------------------------------ */

export type TripStatus =
  | "RIDE_DRAFT"
  | "FARE_ESTIMATED"
  | "SEARCHING_DRIVER"
  | "DRIVER_ASSIGNED"
  | "DRIVER_EN_ROUTE"
  | "DRIVER_ARRIVED"
  | "TRIP_IN_PROGRESS"
  | "TRIP_COMPLETED"
  | "PAYMENT_PENDING"
  | "PAID"
  | "CLOSED"
  | "NO_DRIVER_FOUND"
  | "CANCELLED"
  | "REMATCHING";

export interface Place extends LatLng {
  /** Short label, e.g. "Galle Face Green" */
  name: string;
  /** Full address line */
  address: string;
}

export interface TripStop extends Place {
  id: string;
  sequence: number;
  reachedAt?: string | null;
}

export interface VehicleType {
  id: string;
  code: VehicleTypeCode;
  name: string;
  description: string;
  capacity: number;
  baseFare: number;
  ratePerKm: number;
  ratePerMin: number;
  active: boolean;
  image: string;
}

export interface FareEstimate {
  vehicleTypeId: string;
  vehicleTypeCode: VehicleTypeCode;
  estimatedFare: number;
  distanceKm: number;
  durationMin: number;
  etaMin: number; // nearest driver ETA to pickup
  breakdown: FareBreakdown;
  available?: boolean;
  displayName?: string;
}

export interface FareBreakdown {
  base: number;
  distance: number;
  time: number;
  stops: number;
  waiting: number;
  total: number;
}

export interface TripDriverSummary {
  id: string;
  name: string;
  phone?: string;
  photoUrl?: string | null;
  rating: number;
  ratingCount: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor?: string;
  vehiclePlate: string;
  vehicleTypeCode: VehicleTypeCode;
}

export interface TripRiderSummary {
  id: string;
  name: string;
  phone?: string;
  photoUrl?: string | null;
  rating: number;
}

export interface Trip {
  id: string;
  riderId: string;
  driverId?: string | null;
  vehicleTypeId: string;
  vehicleTypeCode: VehicleTypeCode;
  pickup: Place;
  destination: Place;
  stops: TripStop[];
  status: TripStatus;
  estimatedFare?: number | null;
  finalFare?: number | null;
  distanceKm: number;
  durationMin: number;
  tripPin?: string | null;
  cancellationReason?: string | null;
  cancellationFee?: number | null;
  cancelledBy?: "Rider" | "Driver" | "System" | null;
  matchRoundReached: 1 | 2 | 3;
  version: number;
  requestedAt?: string | null;
  matchedAt?: string | null;
  arrivedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  driver?: TripDriverSummary | null;
  rider?: TripRiderSummary | null;
  payment?: Payment | null;
  myRating?: number | null;
  routeGeometry?: LatLng[];
}

export interface DriverOffer {
  id: string;
  tripId: string;
  driverId: string;
  round: 1 | 2 | 3;
  offeredAt: string;
  respondedAt?: string | null;
  response: "Pending" | "Accepted" | "Rejected" | "TimedOut";
  /** seconds the driver has to respond */
  ttlSeconds: number;
  trip: Trip;
}

export interface Rating {
  id: string;
  tripId: string;
  raterId: string;
  ratedId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

export type ComplaintStatus = "Open" | "UnderReview" | "Resolved";

export interface Complaint {
  id: string;
  tripId: string;
  complainantId: string;
  complainantName: string;
  complainantRole: "Rider" | "Driver";
  category: string;
  details: string;
  status: ComplaintStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export type SosStatus = "Open" | "Investigating" | "Resolved" | "FalseAlarm";

export interface SosAlert {
  id: string;
  tripId: string;
  triggeredByUserId: string;
  triggeredByName: string;
  role: "Rider" | "Driver";
  lat: number;
  lng: number;
  status: SosStatus;
  notes: string[];
  triggeredAt: string;
  resolvedAt?: string | null;
  trip: Trip;
  history: { from: SosStatus | null; to: SosStatus; by: string; at: string }[];
}

/* ------------------------------------------------------------------ */
/* Payment & Fare                                                       */
/* ------------------------------------------------------------------ */

export type PaymentMethod = "Card" | "Cash";
export type PaymentStatus = "Pending" | "AwaitingCash" | "Charged" | "Paid" | "Failed";

export interface Payment {
  id: string;
  tripId: string;
  riderId: string;
  driverId: string;
  estimatedFare: number;
  finalFare: number;
  breakdown: FareBreakdown;
  method: PaymentMethod | null;
  cardAttemptCount: number;
  /** after 2 failed card attempts card is disabled and cash is required */
  cardDisabled: boolean;
  status: PaymentStatus;
  receiptNo?: string;
  createdAt: string;
  processedAt?: string | null;
}

export interface PaymentDispute {
  id: string;
  paymentId: string;
  tripId: string;
  raisedByUserId: string;
  raisedByName: string;
  reason: string;
  status: "Open" | "UnderReview" | "Resolved";
  createdAt: string;
  resolvedAt?: string | null;
}

export interface EarningsSummary {
  period: "daily" | "weekly" | "monthly";
  total: number;
  trips: number;
  cashCollected: number;
  cardEarnings: number;
  onlineMinutes: number;
  series: { label: string; amount: number; trips: number }[];
}

/* ------------------------------------------------------------------ */
/* Admin dashboard aggregates                                           */
/* ------------------------------------------------------------------ */

export interface AdminDashboardStats {
  drivers: { total: number; active: number; pendingVerification: number; suspended: number; onlineNow: number };
  trips: { today: number; completedToday: number; cancelledToday: number; inProgress: number; searching: number };
  revenueToday: number;
  openComplaints: number;
  openSos: number;
  tripsSeries: { label: string; completed: number; cancelled: number }[];
}

/* ------------------------------------------------------------------ */
/* Session & Register                                                   */
/* ------------------------------------------------------------------ */

export interface Session {
  user: User;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  provider: "local" | "oidc" | "mock";
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

/* ------------------------------------------------------------------ */
/* Fare estimation (Trip-Matching microservice)                         */
/* ------------------------------------------------------------------ */

export interface FareOption {
  vehicleTypeId: string;
  vehicleTypeCode: VehicleTypeCode | "TUKTUK";
  /** Human-readable label, e.g. "Tuk Tuk" for TUKTUK. */
  displayName: string;
  available: boolean;
  fare: number;
  distanceKm: number;
  estimatedDurationMinutes: number;
}
