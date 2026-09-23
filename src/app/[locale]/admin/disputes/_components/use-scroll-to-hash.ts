"use client";

import { useEffect, useRef } from "react";

/**
 * Deep links such as `/admin/disputes?dispute=<id>#recording` land before the
 * detail has loaded, so the browser's native anchor jump finds nothing. Once
 * the section exists (`readyKey` set to the loaded dispute id) this scrolls to
 * `location.hash` a single time per dispute.
 */
export function useScrollToHash(readyKey: string | null) {
  const scrolledFor = useRef<string | null>(null);

  useEffect(() => {
    if (readyKey === null || scrolledFor.current === readyKey) return;

    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      scrolledFor.current = readyKey;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [readyKey]);
}
