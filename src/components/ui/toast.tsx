"use client";

import * as React from "react";
import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn, uid } from "@/lib/utils";

export type ToastTone = "success" | "error" | "info" | "warning" | "notification";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  durationMs: number;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "durationMs" | "tone"> & { tone?: ToastTone; durationMs?: number }) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = uid("toast");
    const toast: Toast = { id, tone: "info", durationMs: 4200, ...t };
    set((s) => ({ toasts: [...s.toasts.slice(-3), toast] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "success" }),
  error: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "error", durationMs: 5500 }),
  info: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "info" }),
  warning: (title: string, description?: string) => useToastStore.getState().push({ title, description, tone: "warning" }),
  notify: (title: string, description?: string, action?: Toast["action"]) => useToastStore.getState().push({ title, description, tone: "notification", durationMs: 6000, action }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

const icon: Record<ToastTone, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-brand-500" />,
  error: <XCircle size={18} className="text-danger" />,
  info: <Info size={18} className="text-info" />,
  warning: <AlertTriangle size={18} className="text-warning" />,
  notification: <Bell size={18} className="text-ink" />,
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  React.useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), t.durationMs);
    return () => clearTimeout(id);
  }, [t, dismiss]);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn("pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-black/5 bg-white/95 p-3 pr-2 shadow-float backdrop-blur")}
      role="status"
    >
      <span className="mt-0.5 shrink-0">{icon[t.tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug">{t.title}</p>
        {t.description && <p className="mt-0.5 text-xs font-normal leading-snug text-zinc-600">{t.description}</p>}
        {t.action && (
          <button
            type="button"
            onClick={() => {
              t.action?.onClick();
              dismiss(t.id);
            }}
            className="mt-1.5 text-xs font-semibold text-brand-600 hover:underline"
          >
            {t.action.label}
          </button>
        )}
      </div>
      <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-md p-1 text-zinc-400 hover:bg-surface-2 hover:text-ink">
        <X size={14} />
      </button>
    </motion.div>
  );
}

/** Mount once per shell. `inset` = inside a phone frame (absolute) or viewport (fixed). */
export function Toaster({ position = "absolute" }: { position?: "absolute" | "fixed" }) {
  const toasts = useToastStore((s) => s.toasts);
  return (
    // `fixed` sits just below the 56px shell header so it never covers the title bar.
    <div className={cn("pointer-events-none z-[60] flex flex-col gap-2 p-3", position, position === "fixed" ? "right-0 top-14 w-full max-w-sm" : "inset-x-0 top-0")}>
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastItem key={t.id} t={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
