import type { Locale } from "~/i18n/locale-pathname";

/**
 * Business time zone (launch city: Chihuahua). Every date the UI formats is
 * rendered in this zone on the server and in the browser alike, so SSR and
 * hydration print the same text and a date never shifts by the viewer's or
 * the server's (UTC) clock. Mirrors `FINANCIAL_TIME_ZONE` in the payments
 * service, which owns the money-side cut-offs.
 */
export const BUSINESS_TIME_ZONE = "America/Chihuahua";

/**
 * The route/message locales stay `es` / `en` (URLs, `useLocale()`, message
 * catalogs). Intl formatting, however, needs a region: bare `es` formats
 * money like Spain ("1200,00 MXN"), while Mexico writes "$1,200.00".
 */
const INTL_LOCALE = {
  es: "es-MX",
  en: "en-US",
} as const satisfies Record<Locale, string>;

function isAppLocale(locale: string): locale is Locale {
  return Object.hasOwn(INTL_LOCALE, locale);
}

/** BCP 47 tag to hand to `Intl.*` / next-intl's formatter for an app locale. */
export function intlLocaleFor(locale: string): string {
  return isAppLocale(locale) ? INTL_LOCALE[locale] : INTL_LOCALE.es;
}
