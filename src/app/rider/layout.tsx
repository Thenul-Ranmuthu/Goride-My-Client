"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RoleGuard, useCurrentUser } from "@/components/layout/role-guard";
import { ROUTES } from "@/lib/constants";

/** Routes that render the map/options split instead of a scrolling page body. */
const SPLIT_ROUTES: string[] = [ROUTES.rider.home, ROUTES.rider.ride];

export default function RiderLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    return (
        <RoleGuard role="Rider">
            <RiderFrame split={SPLIT_ROUTES.includes(pathname)}>{children}</RiderFrame>
        </RoleGuard>
    );
}

function RiderFrame({ split, children }: { split: boolean; children: ReactNode }) {
    const user = useCurrentUser()!;
    return (
        <AppShell user={user} variant={split ? "split" : "page"}>
            {children}
        </AppShell>
    );
}
