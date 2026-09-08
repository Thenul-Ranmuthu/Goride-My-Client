"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "brand" | "driver" | "danger" | "secondary" | "outline" | "ghost" | "white";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-white hover:bg-zinc-800 active:bg-zinc-900 shadow-[0_1px_0_rgba(255,255,255,.08)_inset]",
  brand: "bg-brand-400 text-ink hover:bg-brand-300 active:bg-brand-500",
  driver: "bg-driver-500 text-white hover:bg-driver-400 active:bg-driver-600",
  danger: "bg-danger text-white hover:bg-red-500 active:bg-red-700",
  secondary: "bg-surface-2 text-ink hover:bg-surface-3 active:bg-zinc-300",
  outline: "bg-white text-ink border-2 border-ink hover:bg-surface-2",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  white: "bg-white text-ink shadow-card hover:bg-surface-2",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-xs rounded-lg gap-1.5",
  md: "h-11 px-4 text-sm rounded-lg gap-2",
  lg: "h-12 px-5 text-[15px] rounded-xl gap-2",
  icon: "h-10 w-10 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  href?: string;
  full?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, loadingText, leftIcon, rightIcon, href, full = true, children, disabled, type = "button", ...props },
  ref,
) {
  const classes = cn(
    "inline-flex items-center justify-center font-semibold select-none transition-[background-color,transform,opacity] duration-150 active:scale-[0.985] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
    variants[variant],
    sizes[size],
    full && size !== "icon" && "w-full",
    className,
  );
  if (href && !disabled && !loading) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled}>
        {leftIcon}
        {children}
        {rightIcon}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading ? (
        <>
          <Spinner className="h-4 w-4" />
          {loadingText ?? children}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
});

export function IconButton({ className, label, ...props }: ButtonProps & { label: string }) {
  return (
    <Button size="icon" variant="white" aria-label={label} title={label} className={cn("shrink-0", className)} {...props} />
  );
}
