"use client";

import { useAppFormatter } from "~/i18n/use-app-formatter";
import { useCallback } from "react";

/**
 * The only arithmetic allowed on the client: cents -> major units for
 * `Intl.NumberFormat`. Every amount arrives already derived from the server.
 */
export function useCurrencyFormatter(): (cents: number) => string {
  const formatter = useAppFormatter();

  return useCallback(
    (cents: number) =>
      formatter.number(cents / 100, {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [formatter],
  );
}
