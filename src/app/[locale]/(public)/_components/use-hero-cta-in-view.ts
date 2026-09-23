"use client";

import { useEffect, useState } from "react";

/** Marker attribute on the hero's primary CTA wrapper. */
export const HERO_CTA_ATTRIBUTE = "data-hero-cta";

/**
 * Whether the hero's live metal CTA is on screen. Drives the metal budget
 * rule of the nav (see `LandingHeader`). IntersectionObserver only: no scroll
 * listener, no per-frame work.
 *
 * Starts at `true` (server and first paint): the nav action renders the
 * static rim until the browser confirms the hero CTA has left the viewport.
 */
export function useHeroCtaInView(): boolean {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const target = document.querySelector(`[${HERO_CTA_ATTRIBUTE}]`);
    if (target === null) {
      setInView(false);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setInView(entry.isIntersecting);
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, []);

  return inView;
}
