"use client";

import { useRef } from "react";
import { useReducedMotion } from "motion/react";

import { cn } from "~/lib/utils";

import type { DonVictorState } from "./don-victor-choreography";
import { useDonVictorAnimator } from "./use-don-victor-animator";

export type DonVictorSpriteProps = {
  state: DonVictorState;
  /** Rendered size in CSS px. Multiples of 40 keep every sprite pixel whole. */
  size?: number;
  className?: string;
};

/**
 * Don Víctor as a pixel-art canvas. Decorative: the state it mirrors is
 * announced by the composer's status label, so the canvas is hidden from
 * assistive tech to avoid a second announcement.
 */
export function DonVictorSprite({
  state,
  size = 80,
  className,
}: DonVictorSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion() ?? false;

  useDonVictorAnimator(canvasRef, { state, size, reduceMotion });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("block shrink-0 [image-rendering:pixelated]", className)}
      style={{ width: size, height: size }}
    />
  );
}
