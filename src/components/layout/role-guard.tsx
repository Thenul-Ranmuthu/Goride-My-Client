"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/types";
import { useAuthStore } from "@/lib/auth/session";
import { homeForRole, identityLoginUrl, normalizeRole } from "@/lib/constants";
import { FullScreenLoader } from "@/components/ui/spinner";

/**
 * RoleGuard — the AUTH-08 route guard. Waits for session hydration, bounces
 * anonymous users to /login (with returnTo), and returns users who reach an
 * area their role doesn't permit to their own home.
 */
export function RoleGuard({
  role,
  children,
}: {
  role: Role | Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const sessionRole = session ? normalizeRole(session.user.role) : null;
  const roles = React.useMemo(
    () =>
      (Array.isArray(role) ? role : [role]).map((r) => normalizeRole(r) ?? r),
    [role],
  );

  const allowed = !!sessionRole && roles.includes(sessionRole);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      window.location.replace(identityLoginUrl(pathname));
      return;
    }
    if (!allowed) router.replace(homeForRole(sessionRole ?? undefined));
  }, [hydrated, session, allowed, router, pathname, sessionRole]);

  if (!hydrated || !session || !allowed)
    return <FullScreenLoader label={!hydrated ? "Loading…" : "Redirecting…"} />;
  return <>{children}</>;
}

/** Redirect signed-in users away from the auth pages. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const sessionRole = session ? normalizeRole(session.user.role) : null;
  React.useEffect(() => {
    if (hydrated && session)
      router.replace(homeForRole(sessionRole ?? undefined));
  }, [hydrated, session, router, sessionRole]);
  if (!hydrated) return <FullScreenLoader />;
  if (session) return <FullScreenLoader label="Redirecting…" />;
  return <>{children}</>;
}

export function useCurrentUser() {
  return useAuthStore((s) => s.session?.user ?? null);
}
