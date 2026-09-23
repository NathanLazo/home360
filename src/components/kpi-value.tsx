"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useLocale } from "next-intl";

import { MOTION_DURATION_MS, MOTION_EASE_CSS } from "~/components/motion";

export type KpiValueProps = {
  value: number;
  format?: Format;
};

// Corporate motion budget on the transitions.dev scale: digits roll on
// `fast` + smooth-out, fade on `quick`, no overshoot. NumberFlow already
// honours `prefers-reduced-motion` (the value swaps without rolling).
const TRANSFORM_TIMING = {
  duration: MOTION_DURATION_MS.fast,
  easing: MOTION_EASE_CSS.smoothOut,
} as const;
const OPACITY_TIMING = {
  duration: MOTION_DURATION_MS.quick,
  easing: MOTION_EASE_CSS.out,
} as const;

/**
 * Animated KPI figure: digits roll only when the value changes in place
 * (branch or month switch), never on first paint.
 */
export function KpiValue({ value, format }: KpiValueProps) {
  const locale = useLocale();

  return (
    <NumberFlow
      value={value}
      locales={locale}
      format={format}
      transformTiming={TRANSFORM_TIMING}
      spinTiming={TRANSFORM_TIMING}
      opacityTiming={OPACITY_TIMING}
    />
  );
}
