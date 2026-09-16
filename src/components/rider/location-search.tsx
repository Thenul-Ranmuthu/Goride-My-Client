"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Clock, LocateFixed, MapPin, MapPinned, Search, X } from "lucide-react";
import type { Place } from "@/types";
import { searchPlaces } from "@/lib/geo/providers";
import { PLACES } from "@/lib/mock/seed";
import { cn, splitAddress } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/** Debounced place search with local landmarks as instant results. */
export function usePlaceSearch(query: string, enabled = true) {
  const [state, setState] = React.useState<{ q: string; results: Place[] }>({ q: "", results: [] });
  const q = query.trim();
  React.useEffect(() => {
    if (!enabled || q.length < 2) return;
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchPlaces(q);
      if (alive) setState({ q, results: r });
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, enabled]);
  const active = enabled && q.length >= 2;
  return { results: active ? state.results : [], loading: active && state.q !== q };
}

export function SuggestionList({
  items,
  loading,
  onPick,
  recents,
  onUseCurrent,
  onSetOnMap,
  emptyQuery,
  className,
}: {
  items: Place[];
  loading?: boolean;
  onPick: (p: Place) => void;
  recents?: Place[];
  onUseCurrent?: () => void;
  onSetOnMap?: () => void;
  emptyQuery?: boolean;
  className?: string;
}) {
  const showQuick = emptyQuery && (onUseCurrent || onSetOnMap);
  const list = emptyQuery ? (recents ?? []) : items;
  return (
    <div className={cn("flex flex-col", className)}>
      {showQuick && (
        <div className="mb-1 flex gap-2">
          {onUseCurrent && (
            <button type="button" onClick={onUseCurrent} className="flex flex-1 items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-left text-xs font-semibold text-brand-800 transition hover:bg-brand-100">
              <LocateFixed size={16} /> Use current location
            </button>
          )}
          {onSetOnMap && (
            <button type="button" onClick={onSetOnMap} className="flex flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-left text-xs font-semibold transition hover:bg-surface-3">
              <MapPinned size={16} /> Set on map
            </button>
          )}
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-2 px-1 py-3 text-xs text-muted">
          <Spinner className="h-4 w-4" /> Searching…
        </div>
      )}
      {!loading && !emptyQuery && items.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted">No places found. Try a landmark, road or area name.</p>}
      {list.map((p, i) => {
        const { primary, secondary } = splitAddress(p.address);
        return (
          <motion.button
            key={`${p.name}-${p.lat}-${p.lng}`}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 6) * 0.03 }}
            onClick={() => onPick(p)}
            className="flex w-full items-center gap-3 border-b border-zinc-100 py-3 text-left last:border-b-0 hover:bg-surface-2/70"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">{emptyQuery ? <Clock size={17} /> : <MapPin size={17} />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.name}</span>
              <span className="block truncate text-xs font-normal text-muted">{secondary || primary}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  onFocus,
  onClear,
  className,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  onClear?: () => void;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className="h-12 w-full truncate rounded-lg bg-surface-2 pl-10 pr-10 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-ink"
      />
      {value ? (
        <button type="button" aria-label="Clear" onClick={onClear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/70">
          <X size={16} />
        </button>
      ) : (
        <Search size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
      )}
    </div>
  );
}

export const RECENT_PLACES: Place[] = [PLACES.find((p) => p.name === "SLIIT Malabe Campus")!, PLACES.find((p) => p.name === "One Galle Face Mall")!, PLACES.find((p) => p.name === "Colombo Fort Railway Station")!];
