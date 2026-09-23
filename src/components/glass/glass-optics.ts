import type { GlassOptics } from "@samasante/liquid-glass";

/**
 * HOME360 glass look: subtle. Low refraction, light frost, soft sheen, no
 * veil (the tint comes from the surface's own translucent canvas).
 */
export const GLASS_OPTICS: Partial<GlassOptics> = {
  strength: 0.035,
  depth: 0.5,
  curvature: 0.3,
  dispersion: 0.18,
  bend: 0.2,
  frost: 10,
  saturate: 1.6,
  brightness: 0,
  specular: 0.8,
  sheen: 0.25,
  sheenWidth: 2,
  glow: 0.06,
};

/**
 * Reduced motion: keep frost + tint + edge light, drop the refraction that
 * would warp content moving underneath (scroll).
 */
export const GLASS_OPTICS_STILL: Partial<GlassOptics> = {
  ...GLASS_OPTICS,
  strength: 0,
  dispersion: 0,
  bend: 0,
};

/** Corner radii in px (the lens needs numbers); mirror the Tailwind scale. */
export const GLASS_RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
} as const;

export type GlassRadius = keyof typeof GLASS_RADIUS;
export type GlassTone = "light" | "dark";
