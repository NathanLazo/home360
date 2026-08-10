"use client";

import { useFormatter } from "next-intl";

/**
 * Formats server-provided cents as MXN. Dividing by 100 is the only arithmetic
 * the client is allowed to do with money: every amount arrives already derived
 * by the server.
 */
export function useCurrencyFormatter(): (cents: number) => string {
  const formatter = useFormatter();

  return (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}
