"use client";

import * as React from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BottomSheet — the theme's signature surface. Sits inside the phone frame
 * (absolute to the nearest `relative` parent), slides up with a spring,
 * optional drag-to-dismiss and backdrop.
 */
export interface BottomSheetProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  /** Show a dim backdrop behind the sheet (modal feel). */
  backdrop?: boolean;
  /** Show the drag handle / collapse chevron. */
  handle?: boolean | "chevron";
  /** Allow swipe-down to dismiss. */
  dismissible?: boolean;
  /** Max height of the sheet (CSS value). */
  maxHeight?: string;
  ariaLabel?: string;
  /** Reports the rendered sheet height (px) so siblings can sit above it. */
  onHeightChange?: (h: number) => void;
}

export function BottomSheet({ open, onClose, children, className, backdrop = false, handle = true, dismissible = true, maxHeight = "88%", ariaLabel, onHeightChange }: BottomSheetProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    if (!open) {
      onHeightChange?.(0);
      return;
    }
    const el = ref.current;
    if (!el || !onHeightChange) return;
    const ro = new ResizeObserver(() => onHeightChange(el.getBoundingClientRect().height));
    ro.observe(el);
    onHeightChange(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, [open, onHeightChange]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!dismissible || !onClose) return;
    if (info.offset.y > 90 || info.velocity.y > 600) onClose();
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          {backdrop && (
            <motion.button
              type="button"
              aria-label="Close"
              className="absolute inset-0 z-30 bg-black/45 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={dismissible ? onClose : undefined}
            />
          )}
          <motion.section
            ref={ref}
            role="dialog"
            aria-modal={backdrop || undefined}
            aria-label={ariaLabel}
            className={cn(
              // inset-x-0 + mx-auto keeps the sheet full-width in a narrow column
              // and centred (never edge-to-edge) inside a wide desktop region.
              "absolute inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[640px] flex-col overflow-hidden rounded-t-sheet bg-white shadow-sheet",
              className,
            )}
            style={{ maxHeight }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
            drag={dismissible && handle ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={onDragEnd}
          >
            {handle && (
              <button
                type="button"
                aria-label="Collapse"
                onClick={dismissible ? onClose : undefined}
                className="flex w-full cursor-grab items-center justify-center pb-1 pt-2.5 active:cursor-grabbing"
              >
                {handle === "chevron" ? <ChevronDown strokeWidth={2.5} className="text-zinc-300" /> : <span className="h-1.5 w-12 rounded-full bg-zinc-200" />}
              </button>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 safe-bottom">{children}</div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

/** A sheet that's always visible (docked), e.g. the "Find a trip" panel. */
export function DockedPanel({ children, className, position = "bottom" }: { children: React.ReactNode; className?: string; position?: "top" | "bottom" }) {
  return (
    <motion.div
      initial={{ y: position === "bottom" ? 40 : -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className={cn(
        "absolute inset-x-0 z-30 mx-auto w-full max-w-[640px] bg-white",
        position === "bottom" ? "bottom-0 rounded-t-sheet shadow-sheet px-4 pb-4 pt-3 safe-bottom" : "top-0 rounded-b-sheet shadow-card px-4 pb-4 pt-4",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
