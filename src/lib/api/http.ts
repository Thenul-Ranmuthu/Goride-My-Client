/**
 * HTTP adapter for the real GoRide gateway (WSO2 APIM / YARP).
 *
 * Paths follow §7 of the Microservice Design Document:
 *   /auth/*, /users/*, /drivers/*, /admin/audit-log  → Identity & Auth
 *   /location/*, /hubs/*, /notifications/*          → Location & Notification
 *   /trips/*, /vehicle-types/*, /complaints/*         → Trip & Matching
 *   /payments/*, /payment-disputes/*, /earnings/*    → Payment & Fare
 */
import * as signalR from "@microsoft/signalr";
import type { GoRideApi, TripEvent, Unsubscribe } from "./contract";
import { getAccessToken } from "@/lib/auth/session";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

async function http<T>(path: string, init: RequestInit & { json?: unknown; query?: Record<string, string | number | boolean | undefined> } = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (init.query) for (const [k, v] of Object.entries(init.query)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const headers: Record<string, string> = { Accept: "application/json", ...(init.headers as Record<string, string>) };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url.toString(), { ...init, headers, body });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const message = (data && (data.message || data.error || data.title)) || res.statusText || "Request failed";
    throw Object.assign(new Error(message), { status: res.status, code: data?.code, data });
  }
  return data as T;
}

function safeJson(t: string) {
  try {
    return JSON.parse(t);
  } catch {
    return { message: t };
  }
}

/* SignalR tracking hub — one connection, many subscriptions */
let hub: signalR.HubConnection | null = null;
async function getHub() {
  if (hub) return hub;
  hub = new signalR.HubConnectionBuilder()
    .withUrl(`${BASE}/hubs/tracking`, { accessTokenFactory: () => getAccessToken() ?? "" })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();
  await hub.start();
  return hub;
}

function subscribeHub(group: string, handler: (e: TripEvent) => void): Unsubscribe {
  let disposed = false;
  const onTrip = (trip: TripEvent["trip"]) => handler({ type: "trip.updated", trip });
  const onLoc = (location: TripEvent["location"]) => handler({ type: "driver.location", location });
  const onOffer = (offer: TripEvent["offer"]) => handler({ type: "offer.received", offer });
  const onOfferExpired = () => handler({ type: "offer.expired" });
  getHub()
    .then(async (h) => {
      if (disposed) return;
      h.on("TripUpdated", onTrip);
      h.on("DriverLocation", onLoc);
      h.on("OfferReceived", onOffer);
      h.on("OfferExpired", onOfferExpired);
      await h.invoke("Subscribe", group).catch(() => { });
    })
    .catch((e) => console.warn("[signalr] unable to connect", e));
  return () => {
    disposed = true;
    if (!hub) return;
    hub.off("TripUpdated", onTrip);
    hub.off("DriverLocation", onLoc);
    hub.off("OfferReceived", onOffer);
    hub.off("OfferExpired", onOfferExpired);
    hub.invoke("Unsubscribe", group).catch(() => { });
  };
}

export const httpApi: GoRideApi = {
  auth: {
    login: (email, password) => http("/auth/login", { method: "POST", json: { email, password } }),
    register: (payload) => http("/auth/register", { method: "POST", json: payload }),
    requestOtp: (email, purpose) => http("/auth/otp/request", { method: "POST", json: { email, purpose } }),
    verifyOtp: (email, code, purpose, newPassword) => http("/auth/otp/verify", { method: "POST", json: { email, code, purpose, newPassword } }),
    me: () => http("/users/me"),
    logout: () => http("/auth/logout", { method: "POST" }),
  },
  users: {
    get: (id) => http(`/users/${id}`),
    update: (id, patch) => http(`/users/${id}`, { method: "PUT", json: patch }),
    deactivate: (id) => http(`/users/${id}`, { method: "DELETE" }),
    listEmergencyContacts: (userId) => http(`/users/${userId}/emergency-contacts`),
    addEmergencyContact: (userId, c) => http(`/users/${userId}/emergency-contacts`, { method: "POST", json: c }),
    removeEmergencyContact: (userId, id) => http(`/users/${userId}/emergency-contacts/${id}`, { method: "DELETE" }),
    getNotificationPreferences: (userId) => http(`/notifications/preferences/${userId}`),
    updateNotificationPreferences: (userId, prefs) => http(`/notifications/preferences/${userId}`, { method: "PUT", json: prefs }),
    listNotifications: (userId) => http(`/notifications`, { query: { userId } }),
    markNotificationRead: (id) => http(`/notifications/${id}/read`, { method: "POST" }),
  },
  drivers: {
    get: (id) => http(`/drivers/${id}`),
    updateVehicle: (id, vehicle) => http(`/drivers/${id}`, { method: "PUT", json: vehicle }),
    uploadDocument: (id, kind, fileName) => http(`/drivers/${id}/documents`, { method: "POST", json: { kind, fileName } }),
    setOnline: (id, online) => http(`/drivers/${id}/availability`, { method: "PUT", json: { online } }),
    list: (filter) => http(`/drivers`, { query: { status: Array.isArray(filter?.status) ? filter?.status.join(",") : filter?.status, q: filter?.query } }),
    setStatus: (id, action, reason) => http(`/drivers/${id}/status`, { method: "PUT", json: { action, reason } }),
  },
  location: {
    updateDriverLocation: (driverId, pos, heading, status) => http(`/location/update`, { method: "POST", json: { driverId, ...pos, heading, status } }),
    getDriverLocation: (driverId) => http(`/location/${driverId}`),
    nearbyDrivers: (pos, vehicleType, radiusKm = 4) => http(`/location/nearby-drivers`, { query: { lat: pos.lat, lng: pos.lng, vehicleType, radiusKm } }),
  },
  trips: {
    vehicleTypes: () => http(`/vehicle-types`),
    updateVehicleType: (id, patch, reason) => http(`/vehicle-types/${id}`, { method: "PUT", json: { ...patch, reason } }),
    create: (payload) => http(`/trips`, { method: "POST", json: payload }),
    updateStops: (tripId, stops) => http(`/trips/${tripId}/stops`, { method: "PUT", json: { stops } }),
    estimate: (tripId) => http(`/trips/${tripId}/estimate`),
    request: (tripId, vehicleTypeId) => http(`/trips/${tripId}/request`, { method: "POST", json: { vehicleTypeId } }),
    get: (tripId) => http(`/trips/${tripId}`),
    activeForRider: (riderId) => http(`/trips/active`, { query: { riderId } }),
    activeForDriver: (driverId) => http(`/trips/active`, { query: { driverId } }),
    list: (filter) => http(`/trips`, { query: { riderId: filter.riderId, driverId: filter.driverId, status: Array.isArray(filter.status) ? filter.status.join(",") : filter.status, limit: filter.limit } }),
    cancel: (tripId, by, reason, complaint) => http(`/trips/${tripId}`, { method: "DELETE", json: { by, reason, complaint } }),
    retry: (tripId, vehicleTypeId) => http(`/trips/${tripId}/request`, { method: "POST", json: { vehicleTypeId, retry: true } }),
    rate: (tripId, raterId, stars, comment) => http(`/trips/${tripId}/rating`, { method: "POST", json: { raterId, stars, comment } }),
    fileComplaint: (tripId, complainantId, category, details) => http(`/trips/${tripId}/complaints`, { method: "POST", json: { complainantId, category, details } }),
    listComplaints: (filter) => http(`/complaints`, { query: { status: filter?.status } }),
    resolveComplaint: (id, status, resolution) => http(`/complaints/${id}`, { method: "PUT", json: { status, resolution } }),
    triggerSos: (tripId, userId, pos) => http(`/trips/${tripId}/sos/trigger`, { method: "POST", json: { userId, ...pos } }),
    listSos: () => http(`/trips/sos`),
    updateSos: (id, status, note) => http(`/trips/sos/${id}/resolve`, { method: "PUT", json: { status, note } }),
    currentOffer: (driverId) => http(`/trips/offers/current`, { query: { driverId } }),
    accept: (tripId, driverId) => http(`/trips/${tripId}/accept`, { method: "POST", json: { driverId } }),
    decline: (tripId, driverId) => http(`/trips/${tripId}/decline`, { method: "POST", json: { driverId } }),
    setDriverStatus: (tripId, action, pin) => http(`/trips/${tripId}/status`, { method: "PUT", json: { action, pin } }),
    subscribe: (tripId, handler) => subscribeHub(`trip:${tripId}`, handler),
    subscribeDriver: (driverId, handler) => subscribeHub(`driver:${driverId}`, handler),
  },
  payments: {
    get: (tripId) => http(`/payments/${tripId}`),
    selectMethod: (tripId, method) => http(`/payments/${tripId}/select-method`, { method: "POST", json: { method } }),
    cardAttempt: (tripId) => http(`/payments/${tripId}/card-attempt`, { method: "POST" }),
    confirmCash: (tripId) => http(`/payments/${tripId}/confirm-cash`, { method: "POST" }),
    dispute: (tripId, raisedBy, reason) => http(`/payments/${tripId}/dispute`, { method: "POST", json: { raisedBy, reason } }),
    listDisputes: () => http(`/payment-disputes`),
    resolveDispute: (id, status) => http(`/payment-disputes/${id}`, { method: "PUT", json: { status } }),
    list: (filter) => http(`/payments`, { query: filter }),
    earnings: (driverId, period) => http(`/earnings/${driverId}/summary`, { query: { period } }),
  },
  admin: {
    dashboard: () => http(`/admin/dashboard`),
    auditLog: (targetId) => http(`/admin/audit-log`, { query: { targetId } }),
  },
};
