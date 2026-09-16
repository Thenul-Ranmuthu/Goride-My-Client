"use client";

import * as React from "react";
import { Bell, CheckCheck } from "lucide-react";
import type { AppNotification } from "@/types";
import { api } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/sheet";
import { EmptyState, Skeleton } from "@/components/ui/primitives";

export function InboxSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const [items, setItems] = React.useState<AppNotification[] | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    api.users
      .listNotifications(userId)
      .then((n) => alive && setItems(n))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [open, userId]);

  const markAll = async () => {
    if (!items) return;
    await Promise.all(items.filter((n) => !n.read).map((n) => api.users.markNotificationRead(n.id)));
    setItems(items.map((n) => ({ ...n, read: true })));
  };

  return (
    <BottomSheet open={open} onClose={onClose} backdrop maxHeight="80%" ariaLabel="Inbox">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inbox</h2>
        {items && items.some((n) => !n.read) && (
          <button type="button" onClick={markAll} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>
      {!items ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Bell size={22} />} title="No notifications yet" description="Ride updates, payment confirmations and account messages will show up here." compact />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => {
                  if (!n.read) {
                    api.users.markNotificationRead(n.id);
                    setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? prev);
                  }
                }}
                className="flex w-full items-start gap-3 py-3 text-left"
              >
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-brand-500")} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                    <span className="shrink-0 text-[10px] text-muted">{timeAgo(n.sentAt)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs font-normal leading-snug text-zinc-600">{n.message}</span>
                  <span className="mt-1 inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">{n.channel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
