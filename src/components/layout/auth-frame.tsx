"use client";

import * as React from "react";
import { BrandPanel } from "@/components/layout/brand-panel";
import { Toaster } from "@/components/ui/toast";

export interface AuthFrameProps {
  children: React.ReactNode;
  tone?: "auth" | "rider" | "driver";
}

/**
 * AuthFrame — the split screen used by login / signup: the form on the left,
 * the GoRide brand panel on the right. Below `lg` the brand panel drops away
 * and the form takes the full width.
 */
export default function AuthFrame({ children, tone = "auth" }: AuthFrameProps) {
  return (
    <div className="flex h-dvh w-full items-stretch overflow-hidden bg-zinc-100">
      <main className="relative flex h-full w-full min-w-0 flex-col overflow-y-auto bg-white lg:w-1/2 lg:shrink-0">
        <Toaster />
        {/* min-h-full (not flex-1) so pages taller than the viewport scroll `main`
            instead of being clipped by an `h-full` root of their own. */}
        <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-4 py-2 sm:px-6">{children}</div>
      </main>
      <aside className="relative hidden min-w-0 flex-1 overflow-hidden lg:flex">
        <BrandPanel tone={tone} />
      </aside>
    </div>
  );
}
