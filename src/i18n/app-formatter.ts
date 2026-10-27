import { createFormatter } from "next-intl";

import { appFormats } from "~/i18n/formats";
import { BUSINESS_TIME_ZONE, intlLocaleFor } from "~/i18n/intl-locale";

export type AppFormatter = ReturnType<typeof createFormatter>;

const formatterByLocale = new Map<string, AppFormatter>();

/**
 * next-intl formats with the route locale (`es`), which has no region and
 * renders Spain's conventions. This formatter keeps next-intl's API
 * (`number`, `dateTime`, `relativeTime`, `list`, named `appFormats`) but runs
 * on the regional Intl locale (`es-MX` / `en-US`) and the business time zone.
 *
 * Isomorphic and request-independent (no `now`, no headers), so one instance
 * per locale is cached at module scope. Pass `now` explicitly to
 * `relativeTime`.
 */
export function getAppFormatter(locale: string): AppFormatter {
  const intlLocale = intlLocaleFor(locale);
  const cached = formatterByLocale.get(intlLocale);

  if (cached) {
    return cached;
  }

  const formatter = createFormatter({
    locale: intlLocale,
    formats: appFormats,
    timeZone: BUSINESS_TIME_ZONE,
  });
  formatterByLocale.set(intlLocale, formatter);

  return formatter;
}
