"use client";

import { useSyncExternalStore } from "react";

/** Tailwind `sm` breakpoint, exclusive: phones and small tablets. */
export const MOBILE_MEDIA_QUERY = "(max-width: 639.98px)";

function subscribe(query: string, onChange: () => void) {
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/**
 * SSR-safe media query. The server (and the hydrating first client render)
 * report `false`, so markup never mismatches; the real value lands right
 * after hydration. Use it to swap presentation (drawer vs. dialog), never to
 * decide what content exists.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsMobileViewport(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
