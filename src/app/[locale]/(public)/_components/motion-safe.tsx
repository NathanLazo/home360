"use client";

import { useEffect, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  // SSR and first client render agree on `true`, so the static fallback is what
  // paints first and no layout swap happens when motion is allowed.
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    setPrefersReducedMotion(mediaQuery.matches);

    function handleChange(event: MediaQueryListEvent) {
      setPrefersReducedMotion(event.matches);
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

type MotionSafeProps = {
  /** The animated tree (reserved for `AnimatedBeam`). */
  children: React.ReactNode;
  /** Static SVG lines with the exact same geometry and footprint. */
  fallback: React.ReactNode;
};

/**
 * Only wraps `AnimatedBeam`, the single case whose animated and static trees
 * genuinely differ. Duplicating copy or whole sections this way is forbidden.
 */
export function MotionSafe({ children, fallback }: MotionSafeProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return prefersReducedMotion ? fallback : children;
}
