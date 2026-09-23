"use client";

import { motion, useReducedMotion } from "motion/react";

import {
  MOTION_BLUR_PX,
  MOTION_DISTANCE_PX,
  MOTION_DURATION_MS,
  MOTION_EASE,
} from "./motion-tokens";
import { cn } from "~/lib/utils";

const APPEAR_S = MOTION_DURATION_MS.verySlow / 1000;
const PATH_DELAY_S = MOTION_DURATION_MS.micro / 1000;

/**
 * transitions.dev success check, sized for inline use (buttons, rows): fade +
 * rotate upright + blur-in + a small Y-bob, then the tick draws its stroke.
 * Appear only — unmount it to hide. Reduced motion shows the tick at rest.
 */
export function SuccessCheck({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0 overflow-visible", className)}
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              rotate: 80,
              y: MOTION_DISTANCE_PX.base,
              filter: `blur(${MOTION_BLUR_PX.large}px)`,
            }
      }
      animate={{ opacity: 1, rotate: 0, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: APPEAR_S,
        ease: MOTION_EASE.smoothOut,
        y: { duration: APPEAR_S, ease: MOTION_EASE.bounce },
      }}
    >
      <motion.path
        d="M20 6 9 17l-5-5"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: APPEAR_S,
          delay: PATH_DELAY_S,
          ease: MOTION_EASE.smoothOut,
        }}
      />
    </motion.svg>
  );
}
