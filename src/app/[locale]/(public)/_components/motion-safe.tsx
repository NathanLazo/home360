"use client";

import { useLandingReducedMotion } from "./use-landing-reduced-motion";

type MotionSafeProps = {
  /** The animated tree (beams, WebGL metal). */
  children: React.ReactNode;
  /** Static tree with the exact same content and footprint. */
  fallback: React.ReactNode;
};

/**
 * Swaps an animated tree for its static twin under reduced motion. Only for
 * decoration whose animated and static trees genuinely differ; copy is never
 * duplicated this way.
 */
export function MotionSafe({ children, fallback }: MotionSafeProps) {
  const prefersReducedMotion = useLandingReducedMotion();

  return prefersReducedMotion ? fallback : children;
}
