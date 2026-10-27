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

import { MetalFxFallback } from "./metal-fx-fallback";
import { useMetalMotion } from "./use-metal-motion";
import { useHydrated } from "~/hooks/use-hydrated";

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
 *
 * SSR and the hydration render paint `MetalFxFallback` (the library's own
 * no-WebGL markup); the live ring mounts right after hydration. `MetalFx`
 * picks its tree from WebGL2 support during render, so mounting it directly
 * made server and client markup differ (React #418 on every page).
 */
export function MetalRing(props: MetalRingProps) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <MetalFxFallback className={props.className}>
        {props.children}
      </MetalFxFallback>
    );
  }

  return <LiveMetalRing {...props} />;
}

/** Mounted only after hydration so `useMetalBend` binds to the live tree. */
function LiveMetalRing({
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
