"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Role, Session, User } from "@/types";
import { normalizeRole } from "@/lib/constants";

interface AuthState {
  session: Session | null;
  hydrated: boolean;
  setSession: (s: Session | null) => void;
  setUser: (u: User) => void;
  setHydrated: (v: boolean) => void;
}

/**
 * Session store, persisted per tab in sessionStorage — that lets a rider tab
 * and an admin tab coexist in one browser, which is exactly what you want when
 * demoing the three roles side by side. The role cookie lets server code do
 * coarse redirects without reading web storage.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hydrated: false,
      setSession: (session) => {
        const normalized = session
          ? {
              ...session,
              user: {
                ...session.user,
                role: normalizeRole(session.user.role) ?? session.user.role,
              },
            }
          : null;
        writeRoleCookie(normalized?.user.role ?? null);
        set({ session: normalized });
      },
      setUser: (user) =>
        set((st) => (st.session ? { session: { ...st.session, user } } : st)),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: "goride.session",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ session: s.session }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const normalizedSession = state.session
          ? {
              ...state.session,
              user: {
                ...state.session.user,
                role:
                  normalizeRole(state.session.user.role) ??
                  state.session.user.role,
              },
            }
          : null;

        if (normalizedSession) state.setSession(normalizedSession);
        state.setHydrated(true);
        writeRoleCookie(normalizedSession?.user.role ?? null);
      },
    },
  ),
);

function writeRoleCookie(role: Role | null) {
  if (typeof document === "undefined") return;
  if (role)
    document.cookie = `goride_role=${role}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  else document.cookie = "goride_role=; path=/; max-age=0";
}

export function getSession(): Session | null {
  return useAuthStore.getState().session;
}

export function isSessionExpired(s: Session | null) {
  return !s || (s.expiresAt > 0 && Date.now() > s.expiresAt);
}
