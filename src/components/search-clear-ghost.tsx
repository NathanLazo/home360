"use client";

import { motion } from "motion/react";

import {
  MOTION_BLUR_PX,
  MOTION_DISTANCE_PX,
  MOTION_DURATION_MS,
  MOTION_EASE,
} from "~/components/motion";

/**
 * The text that was just cleared, drawn over the input and dropped out
 * (fade + short fall + blur) so the clear reads as an action rather than a
 * blink. Pure decoration: the real input is already empty.
 */
export function SearchClearGhost({
  text,
  onDone,
}: {
  text: string;
  onDone: () => void;
}) {
  return (
    <motion.span
      aria-hidden="true"
      className="text-foreground pointer-events-none absolute inset-y-0 right-8 left-8 flex items-center overflow-hidden text-base whitespace-pre md:text-[0.8125rem]"
      initial={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      animate={{
        opacity: 0,
        y: MOTION_DISTANCE_PX.medium,
        filter: `blur(${MOTION_BLUR_PX.small}px)`,
      }}
      transition={{
        duration: MOTION_DURATION_MS.slow / 1000,
        ease: MOTION_EASE.smoothOut,
      }}
      onAnimationComplete={onDone}
    >
      {text}
    </motion.span>
  );
}
