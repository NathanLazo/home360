"use client";

import { useCallback } from "react";

import {
  MOTION_DISTANCE_PX,
  MOTION_DURATION_MS,
  MOTION_EASE_CSS,
  prefersReducedMotion,
} from "./motion-tokens";

/**
 * transitions.dev error-state shake, per-segment eased (80/60/80/60 ms legs:
 * 6 px, −6 px, 4 px overshoot, rest). WAAPI so it replays on every call and
 * never fights the element's own CSS transitions.
 */
const SEGMENT_A = MOTION_DURATION_MS.micro;
const SEGMENT_B = 60;
const TOTAL = SEGMENT_A * 2 + SEGMENT_B * 2;
const SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: "translateX(0)", easing: MOTION_EASE_CSS.smoothOut },
  {
    transform: `translateX(${MOTION_DISTANCE_PX.small}px)`,
    offset: SEGMENT_A / TOTAL,
    easing: MOTION_EASE_CSS.smoothOut,
  },
  {
    transform: `translateX(-${MOTION_DISTANCE_PX.small}px)`,
    offset: (SEGMENT_A + SEGMENT_B) / TOTAL,
    easing: MOTION_EASE_CSS.smoothOut,
  },
  {
    transform: `translateX(${MOTION_DISTANCE_PX.micro}px)`,
    offset: (SEGMENT_A * 2 + SEGMENT_B) / TOTAL,
    easing: MOTION_EASE_CSS.smoothOut,
  },
  { transform: "translateX(0)" },
];

function shakeElement(element: Element) {
  element.animate(SHAKE_KEYFRAMES, { duration: TOTAL, easing: "linear" });
}

/**
 * Returns `shakeInvalid(form)`: after the invalid state paints, shakes every
 * field inside `form` marked `aria-invalid="true"`. The error styling and
 * message stay as they are — the shake is only the percussive hint. Reduced
 * motion skips it; the border and message still carry the error.
 */
export function useErrorShake() {
  return useCallback((container: HTMLElement | null) => {
    if (container === null || prefersReducedMotion()) {
      return;
    }

    // Wait one frame so React has committed the aria-invalid flags.
    window.requestAnimationFrame(() => {
      container
        .querySelectorAll('[aria-invalid="true"]')
        .forEach((field) => shakeElement(field));
    });
  }, []);
}
