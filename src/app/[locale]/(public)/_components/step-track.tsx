"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring } from "motion/react";

import { useLandingReducedMotion } from "./use-landing-reduced-motion";

/**
 * The line that joins the three steps fills from left to right as the list
 * scrolls through the viewport: progress you can see, tied to your own
 * scrolling. `scaleX` only. Under reduced motion the line is simply full.
 */
export function StepTrack() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useLandingReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "start 35%"],
  });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 40,
    mass: 0.5,
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="bg-border pointer-events-none absolute top-[1.125rem] right-0 left-0 hidden h-px lg:block"
    >
      <motion.div
        style={prefersReducedMotion ? undefined : { scaleX }}
        className="bg-foreground h-px w-full origin-left"
      />
    </div>
  );
}
