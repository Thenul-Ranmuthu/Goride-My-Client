"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Car,
  Lock,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { Role } from "@/types";
import { AppShell } from "@/components/layout/app-shell";
import {
  Badge,
  Card,
  SectionTitle,
  StatTile,
} from "@/components/ui/primitives";
import {
  DEMO_ACCOUNTS,
  ROUTES,
  identityLoginUrl,
  normalizeRole,
  profileForRole,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getMe, MeResponse } from "@/lib/api";
import { useAuthStore } from "@/lib/auth/session";
import { DashboardHistoryGuard } from "@/components/auth/dashboard-history-guard";

const ROLE_CARDS: {
  role: Role;
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}[] = [
  {
    role: "Rider",
    href: ROUTES.rider.profile,
    title: "Rider profile",
    description:
      "Personal details, emergency contacts and notification preferences.",
    icon: <Sparkles size={18} />,
    accent: "bg-brand-500",
  },
  {
    role: "Driver",
    href: ROUTES.driver.profile,
    title: "Driver profile",
    description:
      "Vehicle, licence and verification status alongside your details.",
    icon: <Car size={18} />,
    accent: "bg-driver-500",
  },
  {
    role: "Admin",
    href: ROUTES.admin.profile,
    title: "Admin profile",
    description: "Operator account, granted permissions and security settings.",
    icon: <ShieldCheck size={18} />,
    accent: "bg-navy-900",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const hydrated = useAuthStore((state) => state.hydrated);
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hydrated) return;

    getMe()
      .then((me) => {
        if (!me) {
          window.location.replace(identityLoginUrl("/dashboard"));
          return;
        }
        if (me.roles.length === 0) {
          router.push("/onboarding/select-role");
          return;
        }
        setUser(me);
      })
      .finally(() => setLoading(false));
  }, [router, hydrated]);

  if (loading) return <p>Loading...</p>;
  if (!user) return null;

  return <Dashboard user={user} />;
}

function Dashboard({ user }: { user: MeResponse }) {
  // MeResponse.roles is typed as string[] on the backend response, so it
  // needs a cast to your Role union before it can be used anywhere a Role
  // is expected (ROLE_CARDS, profileForRole, etc).
  const role =
    (user.roles.map((value) => normalizeRole(value)).find(Boolean) as
      | Role
      | undefined) ?? "Rider";
  const myProfile = profileForRole(role);

  // TODO: rating / ratingCount / createdAt aren't on MeResponse — /me looks
  // like a thin identity payload (name, email, roles), not a full profile.
  // Wire these up once you know where they actually come from (a
  // role-specific profile endpoint? an extended /me?) rather than guessing —
  // faking numbers here would just replace a compile error with silently
  // wrong data on the dashboard.
  const stats =
    role === "Driver"
      ? [
          {
            label: "Trips this week",
            value: 27,
            sub: "18 completed · 2 cancelled",
          },
          { label: "Rating", value: "—", sub: "—" },
          { label: "Status", value: "Verified", sub: "Documents approved" },
        ]
      : role === "Admin"
        ? [
            {
              label: "Drivers online",
              value: 42,
              sub: "6 pending verification",
            },
            { label: "Open SOS", value: 0, sub: "3 complaints open" },
            { label: "Trips today", value: 318, sub: "291 completed" },
          ]
        : [
            {
              label: "Trips taken",
              value: "—",
              sub: "Across all vehicle types",
            },
            { label: "Rating", value: "—", sub: "—" },
            { label: "Member since", value: "—", sub: "Thanks for riding" },
          ];

  return (
    // NOTE: AppShell still expects a full `User` (id, role, emailVerified,
    // phoneVerified, +3 more) and MeResponse doesn't satisfy that shape.
    // Not casting this away — `as unknown as User` would just move today's
    // compile error into tomorrow's runtime crash the next time AppShell
    // touches a field MeResponse doesn't actually have (same failure mode as
    // the `user.role` null-deref a few messages back). Needs either
    // AppShell's prop type loosened to MeResponse, or MeResponse mapped to a
    // real User once you share app-shell.tsx.
    <>
      <DashboardHistoryGuard />
      <AppShell
        user={{
          role,
          name: user.name,
          email: user.email,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <h1 className="text-2xl font-bold tracking-tight">
            Hi, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">
            You&apos;re signed in as a{" "}
            <span className="font-semibold text-ink">{role}</span>. Manage your
            account below.
          </p>
        </motion.div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((s, i) => (
            <StatTile
              key={s.label}
              label={s.label}
              value={s.value}
              sub={s.sub}
              tone={i === 0 ? "dark" : "light"}
            />
          ))}
        </div>

        <div className="mt-8">
          <SectionTitle>Your account</SectionTitle>
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink">
              <UserRound size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{user.name}</p>
              {/* phone isn't on MeResponse — drop until it's confirmed the
                backend actually returns it under a different field name */}
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <Link
              href={myProfile}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Open my profile
              <ArrowRight size={16} />
            </Link>
          </Card>
        </div>

        <div className="mt-8">
          <SectionTitle>Profile pages</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            {ROLE_CARDS.map((c) => {
              const mine = c.role === role;
              const demo = DEMO_ACCOUNTS.find((d) => d.role === c.role);
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg text-white",
                        c.accent,
                      )}
                    >
                      {c.icon}
                    </span>
                    {mine ? (
                      <Badge tone="brand">You</Badge>
                    ) : (
                      <Lock size={14} className="text-zinc-400" />
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold">{c.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {c.description}
                  </p>
                  <p
                    className={cn(
                      "mt-3 text-xs font-semibold",
                      mine ? "text-ink" : "text-zinc-400",
                    )}
                  >
                    {mine ? "Open →" : `Sign in as ${demo?.email}`}
                  </p>
                </>
              );
              return mine ? (
                <Link
                  key={c.role}
                  href={c.href}
                  className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-card transition hover:border-ink"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={c.role}
                  className="rounded-xl border border-dashed border-zinc-300 bg-white/60 p-4"
                >
                  {inner}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Each profile page is guarded by role — sign out and use another demo
            account to open the other two.
          </p>
        </div>
      </AppShell>
    </>
  );
}
