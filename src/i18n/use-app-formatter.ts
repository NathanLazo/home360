import { useLocale } from "next-intl";

import { getAppFormatter, type AppFormatter } from "~/i18n/app-formatter";

/**
 * Drop-in replacement for next-intl's `useFormatter()` that formats numbers,
 * money and dates for Mexico (`es-MX` / `en-US`) in the business time zone.
 * Works in Server and Client Components (`useLocale` is available in both).
 */
export function useAppFormatter(): AppFormatter {
  return getAppFormatter(useLocale());
}
