"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, LogOut, MapPin, Menu, X } from "lucide-react";
import type { Role } from "@/types";
import { logout } from "@/lib/auth/actions";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Avatar, RatingInline } from "@/components/ui/primitives";
import { Toaster } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/dialog";
import { InShellProvider, useShellHeader } from "./shell-header";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  exact?: boolean;
}

const RIDER_NAV: NavItem[] = [
  { href: ROUTES.rider.home, label: "Book a ride", icon: MapPin, exact: true },
];

export type AppShellUser = {
  name: string;
  email: string;
  role?: Role;
  id?: string;
  profilePhotoUrl?: string | null;
  rating?: number;
  ratingCount?: number;
};

/**
 * AppShell — the desktop console for riders and drivers: a permanent navy nav
 * rail, a title bar fed by `useSetShellHeader`, and either a scrolling page
 * body (`variant="page"`) or a full-bleed region for the map split
 * (`variant="split"`).
 */
export function AppShell({
  user,
  variant = "page",
  className,
  children,
}: {
  user: AppShellUser;
  variant?: "page" | "split";
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { title, description, backHref, actions } = useShellHeader();
  const [open, setOpen] = React.useState(false);
  const [confirmLogout, setConfirmLogout] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const items = user.role === "Rider" ? RIDER_NAV : [];
  const accent = "text-brand-300";

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const fallbackTitle = items.find((i) => isActive(i))?.label;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
      {items.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-white/65 hover:bg-white/5 hover:text-white",
            )}
          >
            {active && (
              <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-400" />
            )}
            <item.icon
              size={18}
              className={cn(
                active ? accent : "text-white/60 group-hover:text-white",
              )}
            />
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const account = (
    <div className="mt-auto px-3 pt-3">
      <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
        <Avatar
          name={user.name}
          src={user.profilePhotoUrl}
          size="sm"
          tone="bg-brand-400 text-ink"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {user.name}
          </p>
          <p className="truncate text-[11px] text-white/60">{user.email}</p>
        </div>
        <button
          type="button"
          aria-label="Log out"
          onClick={() => setConfirmLogout(true)}
          className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  const brand = (
    <div className="mb-6 flex items-center justify-between px-6">
      <Logo variant="white" height={24} />
      <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
        {user.role ?? "rider"}
      </span>
    </div>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-50 text-ink">
      <Toaster position="fixed" />

      {/* nav rail (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-950 py-5 lg:flex">
        {brand}
        {nav}
        {account}
      </aside>

      {/* nav drawer (mobile) */}
      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy-950 py-5 lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
            >
              <div className="mb-6 flex items-center justify-between px-5">
                <Logo variant="white" height={22} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-3 px-5 pb-4">
                <Avatar
                  name={user.name}
                  src={user.profilePhotoUrl}
                  size="md"
                  tone="bg-brand-400 text-ink"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {user.name}
                  </p>
                  <RatingInline
                    value={user.rating ?? 5}
                    count={user.ratingCount ?? 0}
                    className="text-white/70"
                  />
                </div>
              </div>
              {nav}
              {account}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* main column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 lg:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 hover:bg-surface-2 lg:hidden"
          >
            <Menu size={20} />
          </button>
          {backHref && (
            <Link
              href={backHref}
              aria-label="Go back"
              className="rounded-lg p-2 hover:bg-surface-2"
            >
              <ArrowLeft size={18} strokeWidth={2.5} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight">
              {title ?? fallbackTitle ?? "GoRide"}
            </h1>
            {description && (
              <p className="truncate text-xs text-muted">{description}</p>
            )}
          </div>
          {actions}
          <span className="hidden h-6 w-px bg-zinc-200 sm:block" />
          <span className="hidden items-center gap-2 rounded-lg px-1.5 py-1 sm:flex">
            <Avatar
              name={user.name}
              src={user.profilePhotoUrl}
              size="xs"
              tone="bg-navy-900 text-white"
            />
            <span className="text-xs font-semibold">
              {user.name.split(" ")[0]}
            </span>
          </span>
        </header>

        <InShellProvider value>
          {variant === "split" ? (
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {children}
            </div>
          ) : (
            <main className="min-h-0 flex-1 overflow-y-auto scrollbar-visible">
              <div
                className={cn(
                  "mx-auto w-full max-w-[1100px] p-4 lg:p-6",
                  className,
                )}
              >
                {children}
              </div>
            </main>
          )}
        </InShellProvider>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="Log out of GoRide?"
        description="You'll need to sign in again to book or accept rides."
        confirmLabel="Log out"
        destructive
        position="fixed"
        loading={loggingOut}
        onConfirm={async () => {
          setLoggingOut(true);
          await logout();
          router.replace(ROUTES.home);
        }}
      />
    </div>
  );
}
