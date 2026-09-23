"use client";

import { useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "motion/react";

import { useLandingReducedMotion } from "./use-landing-reduced-motion";
import { cn } from "~/lib/utils";

type MagneticProps = {
  children: React.ReactNode;
  className?: string;
  /** Share of the pointer offset the child follows (0–1). */
  strength?: number;
  /** Hard cap on the travel, in px, so the target never runs from the cursor. */
  maxOffset?: number;
};

const MAGNETIC_SPRING = { duration: 0.45, bounce: 0.15 };

/**
 * Magnetic pull for a primary CTA: the wrapper leans a few pixels toward the
 * mouse and springs home on leave. Decorative only — the child keeps its own
 * hit area, focus ring and press state. Mouse only; static under reduced
 * motion.
 */
export function Magnetic({
  children,
  className,
  strength = 0.22,
  maxOffset = 8,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useLandingReducedMotion();
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const x = useSpring(offsetX, MAGNETIC_SPRING);
  const y = useSpring(offsetY, MAGNETIC_SPRING);
  const transform = useMotionTemplate`translate3d(${x}px, ${y}px, 0)`;

  function clamp(value: number) {
    return Math.max(-maxOffset, Math.min(maxOffset, value));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (
      prefersReducedMotion ||
      event.pointerType !== "mouse" ||
      ref.current === null
    ) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    offsetX.set(
      clamp((event.clientX - (rect.left + rect.width / 2)) * strength),
    );
    offsetY.set(
      clamp((event.clientY - (rect.top + rect.height / 2)) * strength),
    );
  }

  function handlePointerLeave() {
    offsetX.set(0);
    offsetY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={prefersReducedMotion ? undefined : { transform }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  );
}
