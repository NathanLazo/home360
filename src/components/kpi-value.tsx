"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useLocale } from "next-intl";

export type KpiValueProps = {
  value: number;
  format?: Format;
};

// Corporate motion budget: short, ease-out, no overshoot. NumberFlow already
// honours `prefers-reduced-motion` (the value swaps without rolling).
const TRANSFORM_TIMING = {
  duration: 250,
  easing: "cubic-bezier(0.23, 1, 0.32, 1)",
} as const;
const OPACITY_TIMING = { duration: 150, easing: "ease-out" } as const;

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
