"use client";

import { useSyncExternalStore } from "react";

const SOLID_QUERY =
  "(prefers-reduced-transparency: reduce), (prefers-contrast: more)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(SOLID_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return !window.matchMedia(SOLID_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Resolves whether a translucent glass material may render. `false` on the
 * server and during hydration (first paint is the solid surface), and under
 * `prefers-reduced-transparency: reduce` or `prefers-contrast: more`.
 */
export function useGlassMaterial(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
