"use client";

import { useEffect, useState } from "react";
import { isMetalFxSupported } from "metal-fx";
import { useReducedMotion } from "motion/react";

/**
 * Resolves whether a live metal shader should run. `false` on the server's
 * first paint, without WebGL2, or under reduced motion — callers render a
 * static fallback with the same footprint in that case.
 */
export function useMetalMotion(): boolean {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isMetalFxSupported());
  }, []);

  return supported && !prefersReducedMotion;
}
