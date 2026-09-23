"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  BEND_DEFAULTS,
  MetalFx,
  useMetalBend,
  type BendConfig,
  type MetalFxPreset,
  type MetalFxTheme,
  type MetalFxVariant,
} from "metal-fx";

import { useMetalMotion } from "./use-metal-motion";

type MetalRingProps = {
  children: ReactNode;
  preset?: MetalFxPreset;
  variant?: MetalFxVariant;
  /** 0–1. Keep low (≈0.5) on dense product surfaces. */
  strength?: number;
  /** Liquid dent that follows the cursor. Reserve for primary actions. */
  bend?: boolean;
  disableGlow?: boolean;
  /** Match the surface the ring sits on. */
  theme?: MetalFxTheme;
  className?: string;
};

const BEND_OFF: BendConfig = { ...BEND_DEFAULTS, enabled: false };
const BEND_ON: BendConfig = { ...BEND_DEFAULTS, enabled: true };

/**
 * Thin liquid-metal ring around a single interactive child (button, link,
 * avatar). One shared WebGL2 renderer backs every ring on the page.
 *
 * The child always renders: without WebGL2 or under reduced motion the ring
 * is simply absent and the shader paused, so layout never shifts.
 * `normalizeHostStyles` is off to keep the child's focus-visible ring.
 */
export function MetalRing({
  children,
  preset = "silver",
  variant = "button",
  strength = 0.6,
  bend = false,
  disableGlow = false,
  theme = "light",
  className,
}: MetalRingProps) {
  const ref = useRef<HTMLDivElement>(null);
  const live = useMetalMotion();
  const bendRef = useRef<BendConfig>(BEND_OFF);

  useEffect(() => {
    bendRef.current = live && bend ? BEND_ON : BEND_OFF;
  }, [live, bend]);

  useMetalBend(ref, () => bendRef.current);

  return (
    <MetalFx
      ref={ref}
      preset={preset}
      variant={variant}
      theme={theme}
      strength={strength}
      paused={!live}
      disableGlow={disableGlow || !live}
      innerShadow
      normalizeHostStyles={false}
      className={className}
    >
      {children}
    </MetalFx>
  );
}
