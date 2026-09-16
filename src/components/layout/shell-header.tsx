"use client";

import * as React from "react";
import { create } from "zustand";

/**
 * Shell header bus — pages publish their title/description/actions and the
 * surrounding desktop shell renders them in its top bar. Keeps page components
 * free of layout chrome (the same trick AdminShell uses).
 */
export interface ShellHeader {
  title?: string;
  description?: string;
  backHref?: string;
  actions?: React.ReactNode;
}

interface ShellHeaderState extends ShellHeader {
  set: (h: ShellHeader) => void;
}

export const useShellHeader = create<ShellHeaderState>((set) => ({
  set: (h) => set({ title: h.title, description: h.description, backHref: h.backHref, actions: h.actions }),
}));

/** True when the subtree is rendered inside AppShell / AdminShell. */
const InShellContext = React.createContext(false);
export const InShellProvider = InShellContext.Provider;
export function useInShell() {
  return React.useContext(InShellContext);
}

/** Publish a page header into the shell. No-op outside a shell. */
export function useSetShellHeader({ title, description, backHref, actions }: ShellHeader) {
  const inShell = useInShell();
  const set = useShellHeader((s) => s.set);
  React.useEffect(() => {
    if (!inShell) return;
    set({ title, description, backHref, actions });
    return () => set({});
  }, [inShell, title, description, backHref, actions, set]);
}
