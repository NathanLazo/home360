/**
 * transitions.dev motion-token scale for JS-driven motion (motion/react,
 * WAAPI, NumberFlow). Tailwind classes use the same literal values
 * (`duration-250`, `ease-[cubic-bezier(0.22,1,0.36,1)]`) so both lanes stay
 * on one grid. Match a token by usage, never by the nearest number.
 */
export const MOTION_DURATION_MS = {
  /** Per-item stagger offset. */
  stagger: 40,
  /** Intent delay, shake segment. */
  micro: 80,
  /** Modal/dropdown close, text swap, tooltip appear. */
  quick: 150,
  /** Icon swap, dropdown/modal open, tabs sliding, page slide. */
  fast: 250,
  /** Panel close, toast close. */
  medium: 350,
  /** Panel open, skeleton reveal, input clear. */
  slow: 400,
  /** Emphasis moments: success check, badge appear. */
  verySlow: 500,
} as const;

/** Cubic-bezier control points, usable by motion/react (`ease`). */
export const MOTION_EASE = {
  /** Default for surface motion: open/close, slide, resize, position. */
  smoothOut: [0.22, 1, 0.36, 1],
  /** Entrance-only overshoot (badge pop, check bob). Never on a close. */
  bounce: [0.34, 1.36, 0.64, 1],
} as const;

/** Same curves as CSS strings, for WAAPI and NumberFlow timings. */
export const MOTION_EASE_CSS = {
  smoothOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  inOut: "ease-in-out",
  out: "ease-out",
  bounce: "cubic-bezier(0.34, 1.36, 0.64, 1)",
} as const;

export const MOTION_DISTANCE_PX = {
  micro: 4,
  small: 6,
  base: 8,
  medium: 12,
} as const;

export const MOTION_BLUR_PX = {
  small: 2,
  medium: 3,
  large: 8,
} as const;

/** True when the OS asks for less motion. Safe to call during SSR. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
