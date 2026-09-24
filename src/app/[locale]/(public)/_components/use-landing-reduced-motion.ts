"use client";

import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";

/**
 * Landing alias of the shared reduced-motion hook (`~/hooks`): SSR and the
 * first client render agree on `true`, so the static variant paints first.
 */
export const useLandingReducedMotion = usePrefersReducedMotion;
