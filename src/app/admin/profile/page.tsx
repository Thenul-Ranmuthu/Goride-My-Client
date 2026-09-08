"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/session";
import type { User } from "@/types";
import { AppShell } from "@/components/layout/app-shell";
import {
  NotificationPrefsSection,
  ProfileScreen,
} from "@/components/profile/profile-screen";
import { errorMessage, identity } from "@/lib/auth/identity-store";
import { getMe } from "@/lib/api";
import { identityLoginUrl, normalizeRole, ROUTES } from "@/lib/constants";
import { Badge, Card, ListRow, SectionTitle } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

const PERMISSIONS = [
  "Verify, reject and suspend driver accounts",
  "Respond to SOS alerts and safety incidents",
  "Review complaints and trip disputes",
  "Manage vehicle types and fare multipliers",
  "Read the platform audit log",
];

/**
 * Admin profile — the operator's own account page (not the ops dashboard).
 * Admins are provisioned internally, so there's no self-deactivation here.
 */
export default function AdminProfilePage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    const sessionUser = useAuthStore.getState().session?.user;

    if (!sessionUser) {
      window.location.replace(identityLoginUrl(ROUTES.admin.profile));
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
        if (!currentUser || !normalizedRoles.includes("Admin")) {
          router.replace(ROUTES.dashboard);
          return;
        }

        return identity
          .getByEmail(currentUser.email, currentUser.name, "Admin")
          .then((profile) => {
            if (normalizeRole(profile.role) !== "Admin") {
              router.replace(ROUTES.dashboard);
              return;
            }
            setUser({ ...profile, phone: currentUser.phone ?? null });
          });
      })
      .catch((e) =>
        setError(errorMessage(e, "Unable to load your admin profile.")),
      )
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!user) return null;

  return (
    <AppShell
      user={{ role: "Admin", name: user.name, email: user.email }}
      className="max-w-3xl px-0 sm:px-4"
    >
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-card">
        <ProfileScreen
          user={user}
          tone="admin"
          title="Admin profile"
          allowDeactivate={false}
          phoneOnly
        >
          <section className="mt-8">
            <SectionTitle>Access</SectionTitle>
            <Card className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    Platform administrator
                  </p>
                  <p className="text-xs text-muted">
                    Provisioned {formatDate(user.createdAt)}
                  </p>
                </div>
                <Badge tone="ink" dot>
                  Full access
                </Badge>
              </div>
              <ul className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
                {PERMISSIONS.map((p) => (
                  <li
                    key={p}
                    className="flex items-start gap-2 text-xs text-zinc-600"
                  >
                    <CheckCircle2
                      size={14}
                      className="mt-0.5 shrink-0 text-brand-500"
                    />
                    {p}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          <section className="mt-8">
            <SectionTitle>Security</SectionTitle>
            <Card className="divide-y divide-zinc-100 p-0">
              <ListRow
                icon={<KeyRound size={17} />}
                title="Password"
                description="Managed by GoRide ID — change it from the identity provider"
                right={<Badge tone="neutral">GoRide ID</Badge>}
              />
              <ListRow
                icon={<ShieldCheck size={17} />}
                title="Two-factor authentication"
                description="Required for every admin account"
                right={<Badge tone="success">Enabled</Badge>}
              />
              <ListRow
                icon={<MonitorSmartphone size={17} />}
                title="Active sessions"
                description="This browser only"
                right={<Badge tone="neutral">1</Badge>}
              />
            </Card>
            <p className="mt-3 text-[11px] text-muted">
              Every action taken from this account is written to the audit log
              with your admin ID.
            </p>
          </section>

          <NotificationPrefsSection user={user} />
        </ProfileScreen>
      </div>
    </AppShell>
  );
}
