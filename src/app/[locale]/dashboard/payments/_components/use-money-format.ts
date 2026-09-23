"use client";

import { useFormatter } from "next-intl";

const CURRENCY_FORMAT = {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

const DATE_TIME_FORMAT = {
  dateStyle: "medium",
  timeStyle: "short",
} as const;

/**
 * Formatting only: every figure arrives as server-side integer cents and the
 * single client-side operation is cents -> major units for `Intl`.
 */
export function useMoneyFormat() {
  const formatter = useFormatter();

  return {
    currency: (cents: number) => formatter.number(cents / 100, CURRENCY_FORMAT),
    dateTime: (date: Date) => formatter.dateTime(date, DATE_TIME_FORMAT),
  };
}
