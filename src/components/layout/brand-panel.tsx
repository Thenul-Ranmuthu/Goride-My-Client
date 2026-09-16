"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { MapPin, ShieldCheck, Timer, Wallet } from "lucide-react";
import { Logo } from "@/components/brand/logo";


const panelCopy = {
  rider: {
    eyebrow: "Rider",
    headline: "Where to, today?",
    body: "Plan your route, see the fare before you book, and track your driver live — all in a trip lifecycle built to never lose you.",
    points: [
      { icon: Wallet, label: "Upfront fares in LKR, no surprises" },
      { icon: Timer, label: "3-round driver matching in seconds" },
      { icon: ShieldCheck, label: "SOS & emergency contacts, always one tap away" },
    ],
  },
  driver: {
    eyebrow: "Driver",
    headline: "Your hours. Your earnings.",
    body: "Go online when you want, accept the rides you choose, and see daily and monthly earnings the moment a trip is paid.",
    points: [
      { icon: Timer, label: "Requests pushed instantly, 20 s to respond" },
      { icon: Wallet, label: "Card or cash — you confirm cash yourself" },
      { icon: ShieldCheck, label: "Verified riders, SOS for you too" },
    ],
  },
  auth: {
    eyebrow: "GoRide",
    headline: "Ride-hailing, built around one honest trip lifecycle.",
    body: "Registration → matching → tracking → payment → rating. One rider, one driver, one trip — never two drivers on one ride, never a payment charged twice.",
    points: [
      { icon: MapPin, label: "Live GPS tracking under 5 seconds" },
      { icon: Wallet, label: "Card with retry, cash with driver confirmation" },
      { icon: ShieldCheck, label: "Verified drivers, audited admin actions" },
    ],
  },
};

export function BrandPanel({ tone = "auth" }: { tone?: "rider" | "driver" | "auth" }) {
  const copy = panelCopy[tone];
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-navy-950 p-10 text-white lg:p-14">
      {/* map texture */}
      <Image src="/illustrations/map.png" alt="" fill sizes="100vw" className="pointer-events-none select-none scale-110 object-cover opacity-[0.09] blur-[2px] mix-blend-screen" priority={false} />
      <div className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-20 h-[420px] w-[420px] rounded-full bg-brand-400/10 blur-3xl" />

      <div className="relative flex items-center justify-between">
        <Logo variant="white" height={34} />
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/70">{copy.eyebrow}</span>
      </div>

      <div className="relative max-w-xl">
        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl font-bold leading-[1.1] tracking-tight text-balance lg:text-5xl">
          {copy.headline}
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08 }} className="mt-5 max-w-lg text-[15px] font-normal leading-relaxed text-white/70">
          {copy.body}
        </motion.p>
        <ul className="mt-8 space-y-3">
          {copy.points.map((p, i) => (
            <motion.li key={p.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.15 + i * 0.07 }} className="flex items-center gap-3 text-sm text-white/85">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-400/15 text-brand-300">
                <p.icon size={16} />
              </span>
              {p.label}
            </motion.li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-end justify-between gap-6">
        <div className="flex gap-3">
          {[
            { src: "/vehicles/bike.webp", label: "Bike", delay: 0 },
            { src: "/vehicles/tuk.webp", label: "Tuk", delay: 0.6 },
            { src: "/vehicles/car.png", label: "Car", delay: 1.2 },
          ].map((v) => (
            <div key={v.label} className="flex w-28 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm animate-float" style={{ animationDelay: `${v.delay}s` }}>
              <Image src={v.src} alt={v.label} width={96} height={64} className="h-14 w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,.4)]" />
              <span className="mt-1 text-[11px] font-semibold text-white/80">{v.label}</span>
            </div>
          ))}
        </div>
        <p className="hidden text-right text-[11px] leading-relaxed text-white/40 lg:block">
          SE3022 · Case Study Project
          <br />
          Four microservices, one gateway, one honest trip.
        </p>
      </div>
    </div>
  );
}
