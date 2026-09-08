// "use client";

// import { useState } from "react";
// import { selectRole } from "../../../lib/api";

// export default function SelectRole() {
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   async function handleSelect(role: "Driver" | "Rider") {
//     setSubmitting(true);
//     setError(null);
//     try {
//       await selectRole(role);
//       // Force a fresh OIDC round-trip so the new roles claim
//       // gets baked into a new token/cookie. Asgardeo's own session
//       // is still active, so this is silent - no login prompt shown.
//       // eslint-disable-next-line @next/next/no-location-assign-relative-destination
//       window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/login?returnUrl=${encodeURIComponent(`${window.location.origin}/dashboard`)}`;
//       // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     } catch (err) {
//       setError("Something went wrong. Please try again.");
//       setSubmitting(false);
//     }
//   }

//   return (
//     <main>
//       <h1>Are you a Rider or a Driver?</h1>
//       <button disabled={submitting} onClick={() => handleSelect("Rider")}>
//         I am a Rider
//       </button>
//       <br />
//       <br />
//       <button disabled={submitting} onClick={() => handleSelect("Driver")}>
//         I am a Driver
//       </button>
//       {error && <p>{error}</p>}
//     </main>
//   );
// }

"use client";

import { useState } from "react";
import { AlertTriangle, Car, ShieldCheck, User } from "lucide-react";
import { selectRole } from "../../../lib/api";
import { useAuthStore } from "@/lib/auth/session";

export default function SelectRole() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(role: "Driver" | "Rider") {
    setSubmitting(true);
    setError(null);
    try {
      await selectRole(role);
      // Force a fresh OIDC round-trip so the new roles claim
      // gets baked into a new token/cookie. Asgardeo's own session
      // is still active, so this is silent - no login prompt shown.
      useAuthStore.getState().setSession(null);
      window.location.replace(
        `${process.env.NEXT_PUBLIC_API_URL}/login?prompt=login&returnUrl=${encodeURIComponent(`${window.location.origin}/dashboard`)}`,
      );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#0a0f0d] px-3 py-6 sm:px-4 sm:py-12">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-1/3 h-[24rem] w-[24rem] rounded-full bg-orange-500/5 blur-[100px]"
      />

      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 shadow-2xl backdrop-blur-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr]">
          {/* Left: context panel */}
          <div className="flex flex-col justify-center gap-5 border-b border-white/10 p-5 sm:gap-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10">
            <span className="inline-flex w-fit items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              One-time choice
            </span>

            <h1 className="text-3xl font-bold leading-[1.1] text-white sm:text-4xl">
              Choose your GoRide role
            </h1>

            <p className="text-sm leading-relaxed text-zinc-400">
              Your role defines the experience you get inside the app. This
              choice is final after sign-in, and it cannot be changed later.
            </p>

            <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber-400"
              />
              <p className="text-sm leading-relaxed text-amber-200/90">
                <span className="font-semibold text-amber-300">Warning:</span>{" "}
                this role is locked once you sign in. Please choose carefully
                before continuing.
              </p>
            </div>
          </div>

          {/* Right: role cards */}
          <div className="flex flex-col gap-4 p-5 sm:p-8 lg:p-10">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RoleCard
                tone="rider"
                icon={<User size={22} />}
                title="Rider"
                description="Book rides, track your trip, and manage travel details from one place."
                ctaLabel="Continue as Rider"
                disabled={submitting}
                onSelect={() => handleSelect("Rider")}
              />
              <RoleCard
                tone="driver"
                icon={<Car size={22} />}
                title="Driver"
                description="Accept rides, manage your vehicle info, and go online when you are ready."
                ctaLabel="Continue as Driver"
                disabled={submitting}
                onSelect={() => handleSelect("Driver")}
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <ShieldCheck
                size={18}
                className="mt-0.5 shrink-0 text-zinc-400"
              />
              <p className="text-sm leading-relaxed text-zinc-400">
                Once you confirm your role, the app will redirect you to your
                account experience and this choice cannot be changed later.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm font-medium text-red-400">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function RoleCard({
  tone,
  icon,
  title,
  description,
  ctaLabel,
  disabled,
  onSelect,
}: {
  tone: "rider" | "driver";
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  disabled: boolean;
  onSelect: () => void;
}) {
  const isRider = tone === "rider";

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border p-6 transition-colors ${
        isRider
          ? "border-emerald-500/20 bg-emerald-950/30 hover:border-emerald-500/40"
          : "border-orange-500/20 bg-orange-950/20 hover:border-orange-500/40"
      }`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
          isRider
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-orange-500/15 text-orange-400"
        }`}
      >
        {icon}
      </div>

      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        className={`mt-1 w-fit rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          isRider
            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
            : "bg-orange-500/15 text-orange-400 hover:bg-orange-500/25"
        }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
