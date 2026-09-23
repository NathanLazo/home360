"use client";

import { useFormatter } from "next-intl";

/** MXN formatter shared by the orders, requests and offers tables. */
export function useMoney() {
  const formatter = useFormatter();

  return (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
}
