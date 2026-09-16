"use client";

import * as React from "react";
import { useAuthStore } from "@/lib/auth/session";
import { syncMockIdentity } from "@/lib/auth/actions";
import { IS_MOCK } from "@/lib/api";
import { world } from "@/lib/mock/world";

/**
 * App-wide client providers: hydrates the persisted session, re-binds the mock
 * identity, and boots the mock world (so cross-tab sync starts immediately).
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  const userId = useAuthStore((s) => s.session?.user.id);

  React.useEffect(() => {
    if (!hydrated) return;
    syncMockIdentity();
  }, [hydrated, userId]);

  React.useEffect(() => {
    if (!IS_MOCK) return;
    world().get();
    const id = setInterval(() => world().driftIdleDrivers(), 4000);
    return () => clearInterval(id);
  }, []);

  return <>{children}</>;
}
