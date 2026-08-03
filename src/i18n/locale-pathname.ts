import { routing } from "~/i18n/routing";

export type Locale = (typeof routing.locales)[number];

export type LocalePathname = {
  locale: Locale | null;
  pathname: string;
};

export function splitLocaleFromPathname(pathname: string): LocalePathname {
  const segments = pathname.split("/");
  const locale =
    routing.locales.find((candidate) => candidate === segments[1]) ?? null;

  if (!locale) {
    return { locale: null, pathname };
  }

  const pathnameWithoutLocale = `/${segments.slice(2).join("/")}`;

  return {
    locale,
    pathname: pathnameWithoutLocale,
  };
}

export function withLocalePrefix(
  locale: Locale | null,
  pathname: string,
): string {
  if (!locale) {
    return pathname;
  }

  return pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
}
