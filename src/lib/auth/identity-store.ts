"use client";

import type {
  DriverProfile,
  EmergencyContact,
  NotificationPreferences,
  RegisterPayload,
  Role,
  Session,
  User,
} from "@/types";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/constants";
import { sleep, uid } from "@/lib/utils";

/**
 * Browser-local stand-in for the Identity & Auth service.
 *
 * Everything the auth sprint needs — register, login, profile updates,
 * emergency contacts, notification preferences, deactivation — persisted to
 * localStorage so the deployed app works end to end with no gateway behind it.
 * Swap the exported `identity` object for real fetch() calls when the service
 * is live; the signatures already match the API contract.
 */

const DB_KEY = "goride.identity.v1";
const LATENCY_MS = 260;

interface Account {
  user: User;
  password: string;
  driver?: DriverProfile;
  contacts: EmergencyContact[];
  prefs: NotificationPreferences;
}

interface Db {
  accounts: Account[];
}

export class AuthError extends Error {}

/* ------------------------------------------------------------------ */
/* Persistence                                                          */
/* ------------------------------------------------------------------ */

function seed(): Db {
  const now = new Date().toISOString();
  const accounts = DEMO_ACCOUNTS.map((a, i) => {
    const user: User = {
      id: `usr_demo_${a.role.toLowerCase()}`,
      name: a.name,
      email: a.email,
      phone: ["0771234567", "0762223344", "0119876543"][i],
      role: a.role as Role,
      emailVerified: true,
      phoneVerified: true,
      rating: [4.9, 4.8, 5][i],
      ratingCount: [128, 412, 0][i],
      createdAt: now,
    };
    const account: Account = {
      user,
      password: DEMO_PASSWORD,
      contacts: [],
      prefs: {
        userId: user.id,
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
      },
    };
    if (a.role === "Driver") {
      account.driver = {
        driverId: user.id,
        vehicleMake: "Toyota",
        vehicleModel: "Aqua",
        vehiclePlate: "CAB-1234",
        vehicleColor: "White",
        vehicleTypeCode: "CAR",
        licenseNumber: "B1234567",
        licenseExpiry: "2029-04-30",
        status: "Active",
        verifiedAt: now,
        online: false,
      };
    }
    return account;
  });
  return { accounts };
}

function read(): Db {
  if (typeof window === "undefined") return { accounts: [] };
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (!raw) {
      const fresh = seed();
      window.localStorage.setItem(DB_KEY, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw) as Db;
    if (!parsed?.accounts?.length) throw new Error("empty");
    return parsed;
  } catch {
    const fresh = seed();
    window.localStorage.setItem(DB_KEY, JSON.stringify(fresh));
    return fresh;
  }
}

function write(db: Db) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function find(db: Db, id: string) {
  const account = db.accounts.find((a) => a.user.id === id);
  if (!account) throw new AuthError("Account not found.");
  return account;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function makeSession(user: User): Session {
  return {
    user,
    accessToken: `local.${user.id}.${uid()}`,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    provider: "local",
  };
}

/* ------------------------------------------------------------------ */
/* API                                                                  */
/* ------------------------------------------------------------------ */

export const identity = {
  async login(email: string, password: string): Promise<Session> {
    await sleep(LATENCY_MS);
    const db = read();
    const account = db.accounts.find(
      (a) => a.user.email === normalizeEmail(email),
    );
    if (!account || account.password !== password) {
      throw new AuthError("That email and password don't match an account.");
    }
    if (account.user.deactivatedAt) {
      throw new AuthError(
        "This account has been deactivated. Contact support to reactivate it.",
      );
    }
    return makeSession(account.user);
  },

  async register(payload: RegisterPayload): Promise<Session> {
    await sleep(LATENCY_MS);
    const db = read();
    const email = normalizeEmail(payload.email);
    if (db.accounts.some((a) => a.user.email === email)) {
      throw new AuthError(
        "An account with that email already exists. Try signing in instead.",
      );
    }
    const user: User = {
      id: uid("usr"),
      name: payload.name.trim(),
      email,
      phone: payload.phone.trim(),
      role: payload.role,
      emailVerified: false,
      phoneVerified: false,
      rating: 5,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
    };
    const account: Account = {
      user,
      password: payload.password,
      contacts: [],
      prefs: {
        userId: user.id,
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
      },
    };
    if (payload.role === "Driver" && payload.vehicle) {
      account.driver = {
        driverId: user.id,
        vehicleMake: payload.vehicle.make,
        vehicleModel: payload.vehicle.model,
        vehiclePlate: payload.vehicle.plate.toUpperCase(),
        vehicleColor: payload.vehicle.color,
        vehicleTypeCode: payload.vehicle.typeCode,
        licenseNumber: payload.vehicle.licenseNumber,
        licenseExpiry: payload.vehicle.licenseExpiry,
        status: "PendingVerification",
        online: false,
      };
    }
    db.accounts.push(account);
    write(db);
    return makeSession(user);
  },

  async get(id: string): Promise<User> {
    await sleep(80);
    return find(read(), id).user;
  },

  async getByEmail(
    email: string,
    name = email,
    role: Role = "Rider",
  ): Promise<User> {
    await sleep(80);
    const db = read();
    const normalizedEmail = normalizeEmail(email);
    const account = db.accounts.find((a) => a.user.email === normalizedEmail);
    if (!account) {
      const user: User = {
        id: uid("usr"),
        name,
        email: normalizedEmail,
        role,
        emailVerified: true,
        phoneVerified: false,
        rating: 5,
        ratingCount: 0,
        createdAt: new Date().toISOString(),
      };
      db.accounts.push({
        user,
        password: "",
        contacts: [],
        prefs: {
          userId: user.id,
          pushEnabled: true,
          emailEnabled: true,
          smsEnabled: false,
        },
      });
      write(db);
      return user;
    }
    return account.user;
  },

  async update(
    id: string,
    patch: { name?: string; phone?: string },
  ): Promise<User> {
    await sleep(LATENCY_MS);
    const db = read();
    const account = find(db, id);
    account.user = {
      ...account.user,
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
    };
    write(db);
    return account.user;
  },

  async deactivate(id: string): Promise<void> {
    await sleep(LATENCY_MS);
    const db = read();
    const account = find(db, id);
    account.user = { ...account.user, deactivatedAt: new Date().toISOString() };
    write(db);
  },

  /* --- Driver profile ---------------------------------------------- */

  async getDriverProfile(id: string): Promise<DriverProfile | null> {
    await sleep(80);
    return find(read(), id).driver ?? null;
  },

  async updateDriverProfile(
    id: string,
    patch: Partial<DriverProfile>,
  ): Promise<DriverProfile> {
    await sleep(LATENCY_MS);
    const db = read();
    const account = find(db, id);
    if (!account.driver)
      throw new AuthError("This account has no driver profile.");
    account.driver = { ...account.driver, ...patch };
    write(db);
    return account.driver;
  },

  /* --- Emergency contacts (max 3) ----------------------------------- */

  async listEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    await sleep(80);
    return find(read(), userId).contacts;
  },

  async addEmergencyContact(
    userId: string,
    input: Omit<EmergencyContact, "id" | "userId">,
  ): Promise<EmergencyContact> {
    await sleep(LATENCY_MS);
    const db = read();
    const account = find(db, userId);
    if (account.contacts.length >= 3)
      throw new AuthError("You can only have 3 emergency contacts.");
    const contact: EmergencyContact = { id: uid("ec"), userId, ...input };
    account.contacts.push(contact);
    write(db);
    return contact;
  },

  async removeEmergencyContact(
    userId: string,
    contactId: string,
  ): Promise<void> {
    await sleep(LATENCY_MS);
    const db = read();
    const account = find(db, userId);
    account.contacts = account.contacts.filter((c) => c.id !== contactId);
    write(db);
  },

  /* --- Notification preferences ------------------------------------- */

  async getNotificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences> {
    await sleep(80);
    return find(read(), userId).prefs;
  },

  async updateNotificationPreferences(
    userId: string,
    patch: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    await sleep(160);
    const db = read();
    const account = find(db, userId);
    account.prefs = { ...account.prefs, ...patch, userId };
    write(db);
    return account.prefs;
  },
};

/** Turn any thrown value into something safe to show a user. */
export function errorMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (e instanceof AuthError) return e.message;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
