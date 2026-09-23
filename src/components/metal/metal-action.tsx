"use client";

import type { ReactNode } from "react";

import { MetalRing } from "./metal-ring";

type MetalActionProps = {
  children: ReactNode;
  /**
   * Metal marks the action the screen is asking for. A disabled or blocked
   * action renders bare: a live ring on something that cannot be pressed
   * would point the eye at a dead end.
   */
  active?: boolean;
  /** Liquid dent under the cursor: only for the single key CTA of a screen. */
  bend?: boolean;
  strength?: number;
  /** Layout classes for the ring wrapper (e.g. `w-full`, `flex-1`). */
  className?: string;
};

/** Silver ring around one primary action; the only metal a screen should carry. */
export function MetalAction({
  children,
  active = true,
  bend = false,
  strength = 0.6,
  className,
}: MetalActionProps) {
  if (!active) {
    return <>{children}</>;
  }

  return (
    <MetalRing
      preset="silver"
      strength={strength}
      bend={bend}
      className={className}
    >
      {children}
    </MetalRing>
  );
}
