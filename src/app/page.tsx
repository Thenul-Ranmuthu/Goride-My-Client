import Image from "next/image";
import { ArrowRight, Car, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { IdentityLink } from "@/components/auth/identity-link";
import { identityLoginUrl } from "@/lib/constants";

const FEATURES = [
  {
    icon: Wallet,
    title: "Upfront fares",
    body: "See the price in LKR before you book — card or cash, no surprises.",
  },
  {
    icon: MapPin,
    title: "Live tracking",
    body: "Follow your driver on the map with position updates under 5 seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Safety built in",
    body: "SOS, emergency contacts and verified drivers on every trip.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh w-full min-w-0 flex-col overflow-x-hidden bg-navy-950 text-white">
      <header className="w-full">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-3 py-5 sm:px-5 sm:py-6">
          <Logo variant="white" height={30} priority />
          <nav className="flex items-center gap-1 sm:gap-2">
            <IdentityLink
              href={identityLoginUrl("/dashboard")}
              className="rounded-lg px-3 py-2.5 text-sm font-semibold text-white/80 transition-colors hover:text-white sm:px-4"
            >
              Sign in
            </IdentityLink>
            <IdentityLink
              href={identityLoginUrl("/dashboard")}
              className="rounded-lg bg-brand-400 px-3 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-300 sm:px-4"
            >
              Sign up
            </IdentityLink>
          </nav>
        </div>
      </header>

      <main className="relative min-w-0 flex-1 overflow-hidden">
        <Image
          src="/illustrations/map.png"
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none select-none object-cover opacity-[0.08] blur-[2px] mix-blend-screen"
          priority
        />
        <div className="pointer-events-none absolute -right-40 top-0 h-[520px] w-[520px] rounded-full bg-brand-400/20 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-6xl min-w-0 items-center gap-10 px-3 py-10 sm:gap-12 sm:px-5 sm:py-12 md:grid-cols-[minmax(0,1.05fr)_minmax(280px,.95fr)] lg:py-20">
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">
              Sri Lanka
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Your ride, on your terms.
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/70">
              One honest trip lifecycle: registration → matching → tracking →
              payment → rating. One rider, one driver, one trip — never two
              drivers on one ride, never a payment charged twice.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <IdentityLink
                href={identityLoginUrl("/dashboard")}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3.5 text-[15px] font-semibold text-ink transition-colors hover:bg-brand-300"
              >
                Create an account
                <ArrowRight size={18} />
              </IdentityLink>
              <IdentityLink
                href={identityLoginUrl("/dashboard")}
                className="inline-flex items-center gap-2 rounded-xl bg-driver-500 px-5 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-driver-400"
              >
                <Car size={18} />
                Drive with GoRide
              </IdentityLink>
            </div>

            <p className="mt-4 text-xs text-white/50">
              Already with us?{" "}
              <IdentityLink
                href={identityLoginUrl("/dashboard")}
                className="font-semibold text-white underline-offset-2 hover:underline"
              >
                Sign in
              </IdentityLink>{" "}
              — use your WSO account to continue.
            </p>
          </div>

          <ul className="flex min-w-0 flex-col gap-3">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:gap-4 sm:p-5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/15 text-brand-300">
                  <f.icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{f.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/60">
                    {f.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="relative w-full">
        <p className="mx-auto w-full max-w-6xl px-3 py-7 text-[11px] text-white/40 sm:px-5 sm:py-8">
          SE3022 · Case Study Project — four microservices, one gateway, one
          honest trip.
        </p>
      </footer>
    </div>
  );
}
