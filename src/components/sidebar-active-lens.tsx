"use client";

import { motion, useReducedMotion } from "motion/react";

import { GlassLens } from "~/components/glass";
import {
  MOTION_DURATION_MS,
  MOTION_EASE,
} from "~/components/motion/motion-tokens";

const SLIDE = {
  duration: MOTION_DURATION_MS.fast / 1000,
  ease: MOTION_EASE.smoothOut,
} as const;
const INSTANT = { duration: 0 } as const;

/**
 * Liquid Glass bead over the active nav item, framed in a metal hairline.
 * Travels with the static metal notch (`SidebarActiveIndicator`) on the same
 * timing via its own shared `layoutId`; reduced motion snaps.
 */
export function SidebarActiveLens({ layoutId }: { layoutId: string }) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <motion.span
      aria-hidden="true"
      layoutId={layoutId}
      transition={reduceMotion ? INSTANT : SLIDE}
      className="pointer-events-none absolute inset-0 rounded-sm"
    >
      <GlassLens radius="sm" />
    </motion.span>
  );
}
