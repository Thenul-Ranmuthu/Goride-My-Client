"use client";

import type { RegisterPayload, Session, User } from "@/types";
import { identity } from "./identity-store";
import { useAuthStore } from "./session";

export async function loginWithPassword(email: string, password: string): Promise<Session> {
  const session = await identity.login(email, password);
  useAuthStore.getState().setSession(session);
  return session;
}

export async function registerAccount(payload: RegisterPayload): Promise<Session> {
  const session = await identity.register(payload);
  useAuthStore.getState().setSession(session);
  return session;
}

// export function logout() {
//   useAuthStore.getState().setSession(null);
// }
export async function logout() {
  // await fetch("https://localhost:7136/logout", {
  //   method: "GET",
  //   credentials: "include", // needed to send the session cookie so the backend knows which session to kill — same requirement as getMe()
  // });
  useAuthStore.getState().setSession(null);
  window.location.href = "https://localhost:7136/logout";
}

export async function refreshCurrentUser(): Promise<User | null> {
  const st = useAuthStore.getState();
  if (!st.session) return null;
  try {
    const user = await identity.get(st.session.user.id);
    st.setUser(user);
    return user;
  } catch {
    return st.session.user;
  }
}
