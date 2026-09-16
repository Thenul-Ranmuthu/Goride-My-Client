"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Field wrapper                                                        */
/* ------------------------------------------------------------------ */

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}

export function Field({ label, hint, error, htmlFor, className, children, trailing }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {(label || trailing) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
              {label}
            </label>
          )}
          {trailing}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Input                                                                */
/* ------------------------------------------------------------------ */

export const inputBase =
  "w-full rounded-lg bg-surface-2 px-4 text-sm text-ink placeholder:text-zinc-400 outline-none transition-[box-shadow,background-color] focus:bg-white focus:ring-2 focus:ring-ink/90 disabled:cursor-not-allowed disabled:text-zinc-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/70";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  containerClassName?: string;
  trailing?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leftIcon, rightSlot, className, containerClassName, id, type, trailing, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const [show, setShow] = React.useState(false);
  const isPassword = type === "password";
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={containerClassName} trailing={trailing}>
      <div className="relative">
        {leftIcon && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          type={isPassword ? (show ? "text" : "password") : type}
          aria-invalid={!!error}
          className={cn(inputBase, "h-12", leftIcon && "pl-10", (rightSlot || isPassword) && "pr-11", className)}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/70"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        ) : (
          rightSlot && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{rightSlot}</span>
        )}
      </div>
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* Textarea                                                             */
/* ------------------------------------------------------------------ */

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, className, id, ...props }, ref) {
  const autoId = React.useId();
  const taId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={taId}>
      <textarea ref={ref} id={taId} aria-invalid={!!error} className={cn(inputBase, "min-h-24 resize-none py-3", className)} {...props} />
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* Select                                                               */
/* ------------------------------------------------------------------ */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, options, placeholder, className, id, ...props }, ref) {
  const autoId = React.useId();
  const selId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={selId}>
      <div className="relative">
        <select ref={ref} id={selId} aria-invalid={!!error} className={cn(inputBase, "h-12 appearance-none pr-10", className)} {...props}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </Field>
  );
});

/* ------------------------------------------------------------------ */
/* OTP / PIN input                                                      */
/* ------------------------------------------------------------------ */

export function OtpInput({ length = 6, value, onChange, error, autoFocus, label }: { length?: number; value: string; onChange: (v: string) => void; error?: string; autoFocus?: boolean; label?: string }) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const setAt = (i: number, ch: string) => {
    const next = digits.slice();
    next[i] = ch;
    onChange(next.join("").slice(0, length));
  };
  return (
    <Field label={label} error={error}>
      <div className="flex justify-between gap-2" onPaste={(e) => {
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (text) {
          e.preventDefault();
          onChange(text);
          refs.current[Math.min(text.length, length - 1)]?.focus();
        }
      }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            autoFocus={autoFocus && i === 0}
            value={d}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={!!error}
            onChange={(e) => {
              const ch = e.target.value.replace(/\D/g, "").slice(-1);
              setAt(i, ch);
              if (ch && i < length - 1) refs.current[i + 1]?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !digits[i] && i > 0) {
                refs.current[i - 1]?.focus();
                setAt(i - 1, "");
              }
              if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
              if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
            }}
            className={cn(
              "h-13 w-full min-w-0 rounded-lg bg-surface-2 text-center text-xl font-bold tracking-widest text-ink outline-none transition focus:bg-white focus:ring-2 focus:ring-ink",
              error && "ring-2 ring-danger/70",
            )}
          />
        ))}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                               */
/* ------------------------------------------------------------------ */

export function Toggle({ checked, onChange, label, description, disabled, tone = "brand", size = "md" }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; description?: React.ReactNode; disabled?: boolean; tone?: "brand" | "driver" | "ink"; size?: "md" | "lg" }) {
  const on = tone === "driver" ? "bg-driver-500" : tone === "ink" ? "bg-ink" : "bg-brand-500";
  const track = size === "lg" ? "h-8 w-14" : "h-6 w-11";
  const knob = size === "lg" ? "h-6 w-6" : "h-4.5 w-4.5";
  const shift = size === "lg" ? "translate-x-7" : "translate-x-5";
  return (
    <label className={cn("flex items-center justify-between gap-4", disabled && "opacity-60")}>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-semibold">{label}</span>}
          {description && <span className="text-xs text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2", track, checked ? on : "bg-zinc-300")}
      >
        <span className={cn("absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200", knob, checked ? shift : "translate-x-0")} />
      </button>
    </label>
  );
}
