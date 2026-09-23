"use client";

import { motion, useScroll, useSpring } from "motion/react";

import { useLandingReducedMotion } from "./use-landing-reduced-motion";

/**
 * Hairline reading-progress bar along the bottom edge of the sticky header.
 * `scaleX` only; absent under reduced motion (it is pure decoration).
 */
export function ScrollProgress() {
  const prefersReducedMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    mass: 0.3,
  });

  if (prefersReducedMotion) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="bg-foreground/60 pointer-events-none absolute right-0 bottom-0 left-0 h-px origin-left"
    />
  );
}
