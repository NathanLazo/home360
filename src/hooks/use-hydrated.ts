"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * `false` during SSR and the hydration render, `true` afterwards (and on any
 * client-only mount). Gate markup that can only be decided in the browser
 * (WebGL support, storage, media queries) behind it so the first client
 * render matches the server HTML.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
