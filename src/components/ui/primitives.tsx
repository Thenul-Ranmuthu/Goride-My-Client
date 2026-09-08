"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Star } from "lucide-react";
import { cn, initials } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Avatar                                                               */
/* ------------------------------------------------------------------ */

const avatarTones = [
  "bg-brand-400 text-ink",
  "bg-blue-500 text-white",
  "bg-violet-500 text-white",
  "bg-rose-500 text-white",
  "bg-amber-400 text-ink",
  "bg-teal-500 text-white",
  "bg-ink text-white",
];

export function Avatar({
  name,
  src,
  size = "md",
  className,
  tone,
}: {
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  tone?: string;
}) {
  const dims = {
    xs: "h-7 w-7 text-[10px]",
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-16 w-16 text-xl",
    xl: "h-24 w-24 text-3xl",
  }[size];
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0);
  const auto = avatarTones[hash % avatarTones.length];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold",
        dims,
        tone ?? auto,
        className,
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Badge / status pill                                                  */
/* ------------------------------------------------------------------ */

export type Tone =
  | "neutral"
  | "brand"
  | "info"
  | "warning"
  | "danger"
  | "success"
  | "driver"
  | "ink";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  brand: "bg-brand-100 text-brand-800",
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-700",
  driver: "bg-orange-50 text-orange-700",
  ink: "bg-ink text-white",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        toneClasses[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            tone === "success" || tone === "brand"
              ? "bg-brand-500 animate-pulse-dot"
              : "bg-current opacity-70",
          )}
        />
      )}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                 */
/* ------------------------------------------------------------------ */

export function Card({
  className,
  children,
  padded = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-white shadow-card",
        padded && "p-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center justify-between", className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted">
        {children}
      </h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                            */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  sub,
  icon,
  tone = "light",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "light" | "dark" | "brand" | "driver";
  className?: string;
}) {
  const tones = {
    light: "bg-white border border-zinc-200/80 text-ink shadow-card",
    dark: "bg-zinc-800 text-white",
    brand: "bg-brand-400 text-ink",
    driver: "bg-driver-500 text-white",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl p-4", tones, className)}>
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-semibold uppercase tracking-wide",
            tone === "light" ? "text-muted" : "opacity-75",
          )}
        >
          {label}
        </p>
        {icon && <span className="opacity-80">{icon}</span>}
      </div>
      <p className="text-2xl font-bold leading-none tracking-tight">{value}</p>
      {sub && (
        <p
          className={cn(
            "text-[11px]",
            tone === "light" ? "text-muted" : "opacity-75",
          )}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state & Skeleton                                               */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-6" : "gap-3 py-12",
        className,
      )}
    >
      {icon && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-zinc-500">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-xs text-xs font-normal text-muted text-balance">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

export function Divider({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  if (label)
    return (
      <div
        className={cn(
          "flex items-center gap-3 text-[11px] font-medium uppercase tracking-wide text-zinc-400",
          className,
        )}
      >
        <span className="h-px flex-1 bg-zinc-200" />
        {label}
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
    );
  return <div className={cn("h-px w-full bg-zinc-200", className)} />;
}

/* ------------------------------------------------------------------ */
/* List row (settings items)                                            */
/* ------------------------------------------------------------------ */

export function ListRow({
  icon,
  title,
  description,
  href,
  onClick,
  right,
  danger,
  className,
  badge,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  className?: string;
  badge?: React.ReactNode;
}) {
  const inner = (
    <>
      {icon && (
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2",
            danger ? "text-danger" : "text-ink",
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            danger && "text-danger",
          )}
        >
          {title}
        </span>
        {description && (
          <span className="block truncate text-xs font-normal text-muted">
            {description}
          </span>
        )}
      </span>
      {badge}
      {right ??
        ((href || onClick) && (
          <ChevronRight size={18} className="text-zinc-400" />
        ))}
    </>
  );
  const cls = cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-surface-2 active:bg-surface-3",
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return (
    <div className={cls.replace("hover:bg-surface-2 active:bg-surface-3", "")}>
      {inner}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control                                                    */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex w-full rounded-xl bg-surface-2 p-1",
        className,
      )}
      role="tablist"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "flex-1 rounded-lg font-semibold transition-all",
              size === "sm" ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
              active
                ? "bg-white text-ink shadow-card"
                : "text-zinc-500 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rating                                                               */
/* ------------------------------------------------------------------ */

export function RatingInline({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold",
        className,
      )}
    >
      <Star size={12} className="fill-amber-400 text-amber-400" />
      {value.toFixed(1)}
      {count != null && (
        <span className="font-normal text-muted">({count})</span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar                                                              */
/* ------------------------------------------------------------------ */

export function TopBar({
  title,
  subtitle,
  back,
  right,
  className,
  onBack,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: boolean | string;
  right?: React.ReactNode;
  className?: string;
  onBack?: () => void;
}) {
  const router = useRouter();
  const goBack = () => {
    if (onBack) return onBack();
    if (typeof back === "string") return router.push(back);
    router.back();
  };
  return (
    <header
      className={cn(
        "z-20 flex h-14 shrink-0 items-center gap-2 bg-white px-3",
        className,
      )}
    >
      {back && (
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {title && (
          <h1 className="truncate text-lg font-semibold leading-tight">
            {title}
          </h1>
        )}
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
