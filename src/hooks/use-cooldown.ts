"use client";

import * as React from "react";

/** Persisted countdown (survives refresh) — port of the theme's useCooldownTimer. */
export function useCooldown(storageKey: string, seconds = 60) {
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const timer = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const tickFrom = React.useCallback(
    (endAt: number) => {
      if (timer.current) clearInterval(timer.current);
      const update = () => {
        const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        setSecondsLeft(left);
        if (left <= 0) {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
          localStorage.removeItem(storageKey);
        }
      };
      update();
      timer.current = setInterval(update, 1000);
    },
    [storageKey],
  );

  React.useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) tickFrom(parseInt(saved, 10));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [storageKey, tickFrom]);

  const start = React.useCallback(() => {
    const endAt = Date.now() + seconds * 1000;
    localStorage.setItem(storageKey, String(endAt));
    tickFrom(endAt);
  }, [seconds, storageKey, tickFrom]);

  return { secondsLeft, active: secondsLeft > 0, start };
}
