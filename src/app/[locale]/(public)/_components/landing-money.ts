/**
 * Money lives in cents everywhere; only the UI turns it into an amount.
 *
 * The app locales are `es` and `en`, and neither writes pesos the way Mexico
 * does (`es` renders "499 $"). The landing sells to Mexican businesses, so the
 * amount is formatted with the Mexican region of the active locale.
 */
const MONEY_LOCALE: Record<string, string> = {
  es: "es-MX",
  en: "en-MX",
};

export function formatMxnFromCents(
  locale: string,
  cents: number,
  options?: { compact?: boolean },
): string {
  return new Intl.NumberFormat(MONEY_LOCALE[locale] ?? "es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    ...(options?.compact ? { notation: "compact" as const } : {}),
  }).format(cents / 100);
}
