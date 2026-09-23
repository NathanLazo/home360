/**
 * Single motion vocabulary for the admin surfaces (Corporate personality):
 * short, ease-out, transform/opacity only. Every animated admin piece reads
 * its curve and durations from here so nothing drifts.
 */
export const ADMIN_EASE_OUT = [0.23, 1, 0.32, 1] as const;

export const ADMIN_EASE_OUT_CSS = "cubic-bezier(0.23, 1, 0.32, 1)";

export const ADMIN_DURATION = {
  /** Press feedback, hover, small state swaps. */
  fast: 0.15,
  /** Content swaps, indicators, expand/collapse. */
  standard: 0.2,
} as const;

/** Milliseconds variant for APIs that take `EffectTiming`. */
export const ADMIN_DURATION_MS = {
  fast: 150,
  standard: 200,
  number: 240,
} as const;

/**
 * Tailwind class tokens (kept as literals so the compiler picks them up).
 * `PRESS_*` give custom clickable surfaces tactile feedback; the scale is
 * dropped under reduced motion while colour feedback stays.
 */
export const PRESS_SURFACE_CLASS =
  "transition-[background-color,border-color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] motion-reduce:active:scale-100";

export const PRESS_CONTROL_CLASS =
  "transition-[background-color,color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] motion-reduce:active:scale-100";
