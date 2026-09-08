import { cn } from "@/lib/utils";

/** The theme's ring spinner (Spinner.svg), as an inline SVG so it inherits currentColor. */
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5 animate-spin text-current", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="42 150" strokeDashoffset="-16" />
    </svg>
  );
}

export function FullScreenLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[50dvh] w-full flex-col items-center justify-center gap-3 text-muted">
      <Spinner className="h-8 w-8 text-brand-500" />
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}
