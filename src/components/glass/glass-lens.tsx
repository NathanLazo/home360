"use client";

import type { CSSProperties } from "react";
import { Glass } from "@samasante/liquid-glass";
import { useReducedMotion } from "motion/react";

import {
  GLASS_LENS_OPTICS,
  GLASS_LENS_OPTICS_STILL,
  GLASS_RADIUS,
  type GlassRadius,
} from "./glass-optics";
import { useGlassMaterial } from "./use-glass-material";
import { cn } from "~/lib/utils";

export type GlassLensProps = {
  /** Radius token; match the selected item's corners. */
  radius?: GlassRadius;
  className?: string;
};

const RADIUS_CLASS: Record<GlassRadius, string> = {
  xs: "rounded-xs",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  pill: "rounded-pill",
};

// The library pins `display: inline-block`; the lens fills its parent instead.
const FILL_STYLE: CSSProperties = { display: undefined };

/**
 * Selection lens: a clear Liquid Glass bead framed by a polished-metal
 * hairline, laid over the selected item (sidebar active route, highlighted
 * menu option). Decorative and click-through; fills its positioned parent, so
 * the parent owns placement and motion.
 *
 * Chromium bends the item's own icon/label at the rim; Safari/Firefox keep the
 * edge light. The server's first paint, reduced transparency and more contrast
 * render only the metal hairline. Reduced motion drops the bend.
 */
export function GlassLens({ radius = "sm", className }: GlassLensProps) {
  const material = useGlassMaterial();
  const reducedMotion = useReducedMotion() ?? false;
  const shape = RADIUS_CLASS[radius];

  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", shape, className)}
    >
      {material ? (
        <Glass
          data-glass="lens"
          radius={GLASS_RADIUS[radius]}
          optics={reducedMotion ? GLASS_LENS_OPTICS_STILL : GLASS_LENS_OPTICS}
          className={cn("absolute inset-0", shape)}
          style={FILL_STYLE}
        />
      ) : null}
      <span
        className={cn("metal-hairline absolute inset-0 opacity-80", shape)}
      />
    </span>
  );
}
