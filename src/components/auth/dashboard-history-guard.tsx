"use client";

import { useEffect } from "react";

const ROOT_STATE = "gorideDashboardRoot";
const GUARD_STATE = "gorideDashboardGuard";

export function DashboardHistoryGuard() {
  useEffect(() => {
    const currentState = window.history.state ?? {};

    if (!currentState[ROOT_STATE] && !currentState[GUARD_STATE]) {
      window.history.replaceState(
        { ...currentState, [ROOT_STATE]: true },
        "",
        window.location.href,
      );
      window.history.pushState(
        { ...currentState, [GUARD_STATE]: true },
        "",
        window.location.href,
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.[ROOT_STATE]) {
        window.history.go(1);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return null;
}
