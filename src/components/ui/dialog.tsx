"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonVariant } from "./button";

/**
 * Dialog — the theme's Alert: dim + blur backdrop, card scales from 0.75 → 1.
 * Rendered inside the nearest `relative` container (phone frame / admin shell).
 */
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  closeButton?: boolean;
  className?: string;
  /** `fixed` for full-viewport (admin), `absolute` inside the phone frame (default). */
  position?: "absolute" | "fixed";
}

export function Dialog({ open, onClose, title, description, children, footer, size = "sm", closeButton, className, position = "absolute" }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn("inset-0 z-50 flex items-center justify-center p-5", position)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <button type="button" aria-label="Close" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            className={cn(
              "relative w-full rounded-2xl bg-white p-5 pt-6 shadow-float",
              size === "sm" && "max-w-sm",
              size === "md" && "max-w-md",
              size === "lg" && "max-w-2xl",
              className,
            )}
            initial={{ scale: 0.78, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          >
            {closeButton && (
              <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-zinc-500 hover:bg-surface-2">
                <X size={18} />
              </button>
            )}
            {title && <h2 className="text-base font-semibold leading-snug">{title}</h2>}
            {description && <p className="mt-2 text-sm font-normal text-zinc-600 text-pretty">{description}</p>}
            {children && <div className="mt-4">{children}</div>}
            {footer && <div className="mt-5 flex gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Alert — imperative one-button dialog (theme's useAlert)              */
/* ------------------------------------------------------------------ */

export type AlertType = "success" | "failure" | "info" | "warning";

export interface AlertState {
  open: boolean;
  heading: string;
  text: string;
  type: AlertType;
  okLabel?: string;
  onOk?: () => void;
}

export function useAlert() {
  const [alert, setAlert] = React.useState<AlertState>({ open: false, heading: "", text: "", type: "info" });
  const showAlert = React.useCallback((heading: string, text: string, type: AlertType = "info", opts?: { okLabel?: string; onOk?: () => void }) => {
    setAlert({ open: true, heading, text, type, ...opts });
  }, []);
  const hideAlert = React.useCallback(() => setAlert((a) => ({ ...a, open: false })), []);
  return { alert, showAlert, hideAlert };
}

const alertVariant: Record<AlertType, ButtonVariant> = { success: "brand", failure: "danger", info: "primary", warning: "driver" };

export function AlertDialog({ alert, onClose, position }: { alert: AlertState; onClose: () => void; position?: "absolute" | "fixed" }) {
  return (
    <Dialog
      open={alert.open}
      onClose={onClose}
      title={<span className="block text-center">{alert.heading}</span>}
      description={<span className="block text-center">{alert.text}</span>}
      position={position}
      footer={
        <Button
          variant={alertVariant[alert.type]}
          onClick={() => {
            onClose();
            alert.onOk?.();
          }}
        >
          {alert.okLabel ?? "Okay"}
        </Button>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/* Confirm                                                              */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", cancelLabel = "Go back", destructive, loading, children, position }: { open: boolean; onClose: () => void; onConfirm: () => void; title: React.ReactNode; description?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; loading?: boolean; children?: React.ReactNode; position?: "absolute" | "fixed" }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      position={position}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
