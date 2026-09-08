"use client";

import * as React from "react";
import Link from "next/link";
// import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Role } from "@/types";
import { logout } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/constants";
import { Logo } from "@/components/brand/logo";
import { Avatar, Badge } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

interface AppShellUser {
  role: Role;
  name: string;
  email: string;
  profilePhotoUrl?: string | null;
}

/** Signed-in chrome: brand header, who you are, sign out. */
export function AppShell({
  user,
  children,
  className,
}: {
  user: AppShellUser;
  children: React.ReactNode;
  className?: string;
}) {
  // const router = useRouter();
  const tone =
    user.role === "Driver" ? "driver" : user.role === "Admin" ? "ink" : "brand";

  return (
    <div className="flex min-h-dvh flex-col bg-surface-2">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link href={ROUTES.dashboard} className="shrink-0">
            <Logo height={24} priority />
          </Link>
          <Badge tone={tone} className="ml-1">
            {user.role}
          </Badge>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-[13px] font-semibold leading-tight">
                {user.name}
              </span>
              <span className="block text-[11px] leading-tight text-muted">
                {user.email}
              </span>
            </span>
            <Avatar name={user.name} src={user.profilePhotoUrl} size="sm" />
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => logout()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <Toaster position="fixed" />
      <main
        className={cn(
          "mx-auto w-full max-w-5xl flex-1 px-3 py-5 sm:px-4 sm:py-6",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
