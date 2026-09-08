"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/session";
import type { User } from "@/types";
import { AppShell } from "@/components/layout/app-shell";
import {
  EmergencyContactsSection,
  NotificationPrefsSection,
  ProfileScreen,
} from "@/components/profile/profile-screen";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import { getMe } from "@/lib/api";
import { identityLoginUrl, normalizeRole, ROUTES } from "@/lib/constants";

/** Rider profile — FR-AUTH-04 / FR-AUTH-05 / FR-AUTH-07. */
export default function RiderProfilePage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    const sessionUser = useAuthStore.getState().session?.user;

    if (!sessionUser) {
      window.location.replace(identityLoginUrl(ROUTES.rider.profile));
      return;
    }

    getMe()
      .then((me) => {
        const currentUser =
          me ??
          (sessionUser
            ? {
                userId: sessionUser.id,
                name: sessionUser.name,
                email: sessionUser.email,
                phone: sessionUser.phone ?? null,
                roles: [sessionUser.role],
              }
            : null);

        const normalizedRoles = (currentUser?.roles ?? []).map((value) =>
          normalizeRole(value),
        );
        if (!currentUser || !normalizedRoles.includes("Rider")) {
          router.replace(ROUTES.dashboard);
          return;
        }

        return identity
          .getByEmail(currentUser.email, currentUser.name, "Rider")
          .then((profile) => {
            if (normalizeRole(profile.role) !== "Rider") {
              router.replace(ROUTES.dashboard);
              return;
            }
            setUser({ ...profile, phone: currentUser.phone ?? null });
          });
      })
      .catch((e) =>
        setError(errorMessage(e, "Unable to load your rider profile.")),
      )
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!user) return null;

  return (
    <AppShell
      user={{ role: "Rider", name: user.name, email: user.email }}
      className="max-w-3xl px-0 sm:px-4"
    >
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <ProfileScreen user={user} tone="rider" title="Rider profile" phoneOnly>
          <EmergencyContactsSection user={user} />
          <NotificationPrefsSection user={user} />
        </ProfileScreen>
      </div>
    </AppShell>
  );
}
