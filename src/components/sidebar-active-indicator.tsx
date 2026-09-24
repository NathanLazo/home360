"use client";

import { motion, useReducedMotion } from "motion/react";

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
 * Action-tint notch (sky → lime, no WebGL — outside the live budget) marking
 * the active nav item. One shared `layoutId` makes it slide between items on
 * navigation, so the eye follows where it went; reduced motion snaps.
 */
export function SidebarActiveIndicator({ layoutId }: { layoutId: string }) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <motion.span
      aria-hidden="true"
      layoutId={layoutId}
      transition={reduceMotion ? INSTANT : SLIDE}
      className="from-tint-sky to-tint-lime shadow-hairline pointer-events-none absolute inset-y-1.5 -left-2 w-[3px] rounded-full bg-linear-to-b"
    />
  );
}
