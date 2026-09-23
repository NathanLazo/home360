"use client";

import type { ReactNode } from "react";

import type { MetalFxPreset } from "metal-fx";

import { MetalRing } from "./metal-ring";

type MetalActionProps = {
  children: ReactNode;
  /**
   * Metal marks the action the screen is asking for. A disabled or blocked
   * action shows no ring: a live ring on something that cannot be pressed
   * would point the eye at a dead end. The wrapper stays mounted either way
   * so toggling never remounts the button (keeps focus and hover state).
   */
  active?: boolean;
  /** Liquid dent under the cursor: only for the single key CTA of a screen. */
  bend?: boolean;
  /**
   * `chromatic` is the product's signature (the owner's pick, same as the
   * landing hero); `silver` is the quieter fallback for crowded surfaces.
   */
  preset?: MetalFxPreset;
  strength?: number;
  /** Layout classes for the ring wrapper (e.g. `w-full`, `flex-1`). */
  className?: string;
};

/** Liquid-metal ring around one primary action; the only live metal a screen should carry. */
export function MetalAction({
  children,
  active = true,
  bend = false,
  preset = "chromatic",
  strength = 1,
  className,
}: MetalActionProps) {
  return (
    <MetalRing
      preset={preset}
      strength={active ? strength : 0}
      bend={active && bend}
      disableGlow={!active}
      className={className}
    >
      {children}
    </MetalRing>
  );
}
