"use client";

import NumberFlow, { type Format } from "@number-flow/react";
import { useLocale } from "next-intl";

import { ADMIN_DURATION_MS, ADMIN_EASE_OUT_CSS } from "./admin-motion";
import { cn } from "~/lib/utils";

const TRANSFORM_TIMING = {
  duration: ADMIN_DURATION_MS.number,
  easing: ADMIN_EASE_OUT_CSS,
};
const OPACITY_TIMING = {
  duration: ADMIN_DURATION_MS.fast,
  easing: "ease-out",
};

export type AnimatedNumberProps = {
  value: number;
  format?: Format;
  className?: string;
};

/**
 * KPI figures roll digit-by-digit only when a refetch changes them; the first
 * paint is static (no entrance motion) and NumberFlow already honours
 * `prefers-reduced-motion`, rendering the final value directly.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: AnimatedNumberProps) {
  const locale = useLocale();

  return (
    <NumberFlow
      value={value}
      locales={locale}
      format={format}
      transformTiming={TRANSFORM_TIMING}
      spinTiming={TRANSFORM_TIMING}
      opacityTiming={OPACITY_TIMING}
      className={cn("tabular-nums", className)}
    />
  );
}

/** MXN with cents: the only currency format the admin renders. */
export const MXN_FORMAT: Format = {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};
