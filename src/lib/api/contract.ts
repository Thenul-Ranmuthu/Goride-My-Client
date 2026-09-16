import type {
  AdminAction,
  AdminActionType,
  AdminDashboardStats,
  AppNotification,
  Complaint,
  ComplaintStatus,
  DocumentKind,
  Driver,
  DriverLocation,
  DriverOffer,
  DriverStatus,
  EarningsSummary,
  EmergencyContact,
  FareEstimate,
  LatLng,
  NotificationPreferences,
  Payment,
  PaymentDispute,
  PaymentMethod,
  Place,
  Session,
  SosAlert,
  SosStatus,
  Trip,
  TripStatus,
  User,
  VehicleType,
  VehicleTypeCode,
} from "@/types";

export type { FareEstimate, Trip, FareBreakdown, VehicleType } from "@/types";

/* ------------------------------------------------------------------ */
/* Payloads                                                             */
/* ------------------------------------------------------------------ */

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "Rider" | "Driver";
  vehicle?: { make: string; model: string; plate: string; color: string; typeCode: VehicleTypeCode; licenseNumber: string; licenseExpiry: string };
}

export interface CreateTripPayload {
  riderId: string;
  pickup: Place;
  destination: Place;
  stops?: Place[];
}

export type DriverTripAction = "EnRoute" | "Arrived" | "InProgress" | "Completed";

export interface TripEvent {
  type: "trip.updated" | "driver.location" | "offer.received" | "offer.expired" | "trip.sos";
  trip?: Trip;
  location?: DriverLocation;
  offer?: DriverOffer;
}

export type Unsubscribe = () => void;

export interface TripFilter {
  riderId?: string;
  driverId?: string;
  status?: TripStatus | TripStatus[];
  limit?: number;
}

export interface ApiError extends Error {
  status: number;
  code?: string;
}

/* ------------------------------------------------------------------ */
/* Contract                                                             */
/* ------------------------------------------------------------------ */

export interface GoRideApi {
  auth: {
    /** Password login (mock / fallback). In OIDC mode the WSO2 flow is used instead — see lib/auth/oidc.ts. */
    login(email: string, password: string): Promise<Session>;
    register(payload: RegisterPayload): Promise<{ user: User; requiresVerification: boolean }>;
    requestOtp(email: string, purpose: "PasswordReset" | "EmailVerify" | "PhoneVerify"): Promise<void>;
    verifyOtp(email: string, code: string, purpose: "PasswordReset" | "EmailVerify" | "PhoneVerify", newPassword?: string): Promise<void>;
    me(): Promise<User>;
    logout(): Promise<void>;
  };

  users: {
    get(id: string): Promise<User>;
    update(id: string, patch: { name?: string; phone?: string; profilePhotoUrl?: string | null }): Promise<User>;
    deactivate(id: string): Promise<void>;
    listEmergencyContacts(userId: string): Promise<EmergencyContact[]>;
    addEmergencyContact(userId: string, c: Omit<EmergencyContact, "id" | "userId">): Promise<EmergencyContact>;
    removeEmergencyContact(userId: string, contactId: string): Promise<void>;
    getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
    updateNotificationPreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
    listNotifications(userId: string): Promise<AppNotification[]>;
    markNotificationRead(id: string): Promise<void>;
  };

  drivers: {
    get(id: string): Promise<Driver>;
    updateVehicle(id: string, vehicle: Partial<Driver["profile"]>): Promise<Driver>;
    uploadDocument(id: string, kind: DocumentKind, fileName: string): Promise<Driver>;
    setOnline(id: string, online: boolean): Promise<Driver>;
    /** Admin */
    list(filter?: { status?: DriverStatus | DriverStatus[]; query?: string }): Promise<Driver[]>;
    /** Admin — Approve / Reject / Suspend / Deactivate / Reactivate; writes the audit trail */
    setStatus(id: string, action: AdminActionType, reason: string): Promise<Driver>;
  };

  location: {
    updateDriverLocation(driverId: string, pos: LatLng, heading: number, status: DriverLocation["status"]): Promise<void>;
    getDriverLocation(driverId: string): Promise<DriverLocation | null>;
    nearbyDrivers(pos: LatLng, vehicleType?: VehicleTypeCode, radiusKm?: number): Promise<DriverLocation[]>;
  };

  trips: {
    vehicleTypes(): Promise<VehicleType[]>;
    updateVehicleType(id: string, patch: Partial<Pick<VehicleType, "baseFare" | "ratePerKm" | "ratePerMin" | "active">>, reason: string): Promise<VehicleType>;
    create(payload: CreateTripPayload): Promise<Trip>;
    updateStops(tripId: string, stops: Place[]): Promise<Trip>;
    estimate(tripId: string): Promise<FareEstimate[]>;
    request(tripId: string, vehicleTypeId: string): Promise<Trip>;
    get(tripId: string): Promise<Trip>;
    /** Restore an active booking after refresh / reconnect (FR-PICK-08 / FR-TRIP-07). */
    activeForRider(riderId: string): Promise<Trip | null>;
    activeForDriver(driverId: string): Promise<Trip | null>;
    list(filter: TripFilter): Promise<Trip[]>;
    cancel(tripId: string, by: "Rider" | "Driver", reason: string, complaint?: { category: string; details: string }): Promise<Trip>;
    retry(tripId: string, vehicleTypeId?: string): Promise<Trip>;
    rate(tripId: string, raterId: string, stars: number, comment?: string): Promise<void>;
    fileComplaint(tripId: string, complainantId: string, category: string, details: string): Promise<Complaint>;
    listComplaints(filter?: { status?: ComplaintStatus }): Promise<Complaint[]>;
    resolveComplaint(id: string, status: ComplaintStatus, resolution?: string): Promise<Complaint>;
    triggerSos(tripId: string, userId: string, pos: LatLng): Promise<SosAlert>;
    listSos(): Promise<SosAlert[]>;
    updateSos(id: string, status: SosStatus, note?: string): Promise<SosAlert>;
    /** Driver side */
    currentOffer(driverId: string): Promise<DriverOffer | null>;
    accept(tripId: string, driverId: string): Promise<Trip>;
    decline(tripId: string, driverId: string): Promise<void>;
    setDriverStatus(tripId: string, action: DriverTripAction, pin?: string): Promise<Trip>;
    /** Real-time stream for a trip (SignalR in http mode). */
    subscribe(tripId: string, handler: (e: TripEvent) => void): Unsubscribe;
    /** Real-time stream for a driver's offers / assignments. */
    subscribeDriver(driverId: string, handler: (e: TripEvent) => void): Unsubscribe;
  };

  payments: {
    get(tripId: string): Promise<Payment | null>;
    selectMethod(tripId: string, method: PaymentMethod): Promise<Payment>;
    cardAttempt(tripId: string, opts?: { forceFail?: boolean }): Promise<Payment>;
    confirmCash(tripId: string): Promise<Payment>;
    dispute(tripId: string, raisedBy: string, reason: string): Promise<PaymentDispute>;
    listDisputes(): Promise<PaymentDispute[]>;
    resolveDispute(id: string, status: PaymentDispute["status"]): Promise<PaymentDispute>;
    list(filter: { riderId?: string; driverId?: string }): Promise<Payment[]>;
    earnings(driverId: string, period: EarningsSummary["period"]): Promise<EarningsSummary>;
  };

  admin: {
    dashboard(): Promise<AdminDashboardStats>;
    auditLog(targetId?: string): Promise<AdminAction[]>;
  };
}
