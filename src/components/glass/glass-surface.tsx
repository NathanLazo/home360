"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { Glass, type GlassOptics } from "@samasante/liquid-glass";
import { useReducedMotion } from "motion/react";

import {
  GLASS_OPTICS,
  GLASS_OPTICS_STILL,
  GLASS_RADIUS,
  type GlassRadius,
  type GlassTone,
} from "./glass-optics";
import { useGlassMaterial } from "./use-glass-material";
import { cn } from "~/lib/utils";

export type GlassSurfaceProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> & {
  children: ReactNode;
  /**
   * `light` = translucent canvas with ink content; `dark` = translucent ink
   * with light content (scopes `.dark` tokens for its children).
   */
  tone?: GlassTone;
  /** Radius token: sm 6 · md 8 · lg 12 · xl 16 · pill. */
  radius?: GlassRadius;
  /** Escape hatch over the tuned look. Keep it subtle. */
  optics?: Partial<GlassOptics>;
};

const TONE_CLASS: Record<GlassTone, { glass: string; solid: string }> = {
  light: {
    glass: "bg-canvas/70 text-foreground",
    solid: "bg-canvas text-foreground",
  },
  dark: {
    glass: "dark bg-[oklch(0.205_0_0/0.72)] text-foreground",
    solid: "dark bg-canvas text-foreground",
  },
};

const RADIUS_CLASS: Record<GlassRadius, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  pill: "rounded-pill",
};

/**
 * Liquid Glass surface for floating/sticky chrome over content (nav bars,
 * sticky save bars, floating toolbars, optionally popovers). Never on dense
 * tables or cards.
 *
 * Chromium refracts the live page; Safari/Firefox frost + tint + edge-light.
 * The server's first paint, `prefers-reduced-transparency` and
 * `prefers-contrast: more` render the same box as a solid canvas with a
 * hairline — no layout shift. Under reduced motion refraction is dropped.
 *
 * Layout goes through `className` as usual (`flex`, padding, width…).
 */
export function GlassSurface({
  children,
  tone = "light",
  radius = "lg",
  optics,
  className,
  style,
  ...rest
}: GlassSurfaceProps) {
  const material = useGlassMaterial();
  const reducedMotion = useReducedMotion() ?? false;

  const base = cn(
    "shadow-float",
    RADIUS_CLASS[radius],
    material ? TONE_CLASS[tone].glass : TONE_CLASS[tone].solid,
    className,
  );

  if (!material) {
    return (
      <div data-glass="solid" className={base} style={style} {...rest}>
        {children}
      </div>
    );
  }

  // The library pins `display: inline-block` inline; unset it so `className`
  // owns layout exactly as on the solid surface.
  const glassStyle: CSSProperties = { display: undefined, ...style };

  return (
    <Glass
      data-glass="material"
      radius={GLASS_RADIUS[radius]}
      optics={{
        ...(reducedMotion ? GLASS_OPTICS_STILL : GLASS_OPTICS),
        ...optics,
      }}
      className={base}
      style={glassStyle}
      {...rest}
    >
      {children}
    </Glass>
  );
}
