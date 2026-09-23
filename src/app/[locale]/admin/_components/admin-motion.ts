import {
  MOTION_DISTANCE_PX,
  MOTION_DURATION_MS,
  MOTION_EASE,
  MOTION_EASE_CSS,
} from "~/components/motion";

/**
 * Admin motion vocabulary (Corporate personality): short, ease-out,
 * transform/opacity only. Every value is picked by *usage* from the shared
 * transitions.dev token scale in `~/components/motion`, so the admin never
 * drifts from the rest of the platform.
 */

/** `--ease-smooth-out`: surface motion — open/close, slide, resize, position. */
export const ADMIN_EASE_OUT = MOTION_EASE.smoothOut;

export const ADMIN_EASE_OUT_CSS = MOTION_EASE_CSS.smoothOut;

/** Seconds, for motion/react transitions. */
export const ADMIN_DURATION = {
  /** `--duration-quick`: press/hover feedback, quick exits. */
  fast: MOTION_DURATION_MS.quick / 1000,
  /**
   * `--duration-fast`: tabs sliding, pane swap, accordion — the symmetric
   * "one reversible motion" family.
   */
  standard: MOTION_DURATION_MS.fast / 1000,
} as const;

/** Milliseconds variant for APIs that take `EffectTiming`. */
export const ADMIN_DURATION_MS = {
  fast: MOTION_DURATION_MS.quick,
  standard: MOTION_DURATION_MS.fast,
  /** NumberFlow digit roll; no token usage matches, kept as tuned. */
  number: 240,
} as const;

/** `--duration-stagger`, in seconds: per-item offset for small reveals. */
export const ADMIN_STAGGER_S = MOTION_DURATION_MS.stagger / 1000;

/** `--distance-micro`: in-place settle of a swapped pane. */
export const ADMIN_SETTLE_PX = MOTION_DISTANCE_PX.micro;

/**
 * How long a confirmed dialog stays on screen after success so the check
 * (`--duration-very-slow`) can land, plus a short read beat, before closing.
 */
export const ADMIN_SUCCESS_HOLD_MS = MOTION_DURATION_MS.verySlow + 300;

/** Covers a dialog's exit so its button label never flips back mid-close. */
export const ADMIN_DIALOG_EXIT_MS = MOTION_DURATION_MS.medium;

/** How long the "copied" check stays before the copy icon returns. */
export const ADMIN_COPIED_HOLD_MS = 1500;

/**
 * Tailwind class tokens (kept as literals so the compiler picks them up).
 * `PRESS_*` give custom clickable surfaces tactile feedback; the scale is
 * dropped under reduced motion while colour feedback stays.
 */
export const PRESS_SURFACE_CLASS =
  "transition-[background-color,border-color,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.99] motion-reduce:active:scale-100";

export const PRESS_CONTROL_CLASS =
  "transition-[background-color,color,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] motion-reduce:active:scale-100";
