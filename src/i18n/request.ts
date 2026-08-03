import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "./routing";

async function loadSpanishMessages() {
  const [common, landing, auth, dashboard, admin, errors] = await Promise.all([
    import("~/messages/es/common.json"),
    import("~/messages/es/landing.json"),
    import("~/messages/es/auth.json"),
    import("~/messages/es/dashboard.json"),
    import("~/messages/es/admin.json"),
    import("~/messages/es/errors.json"),
  ]);

  return {
    common: common.default,
    landing: landing.default,
    auth: auth.default,
    dashboard: dashboard.default,
    admin: admin.default,
    errors: errors.default,
  };
}

async function loadEnglishMessages() {
  const [common, landing, auth, dashboard, admin, errors] = await Promise.all([
    import("~/messages/en/common.json"),
    import("~/messages/en/landing.json"),
    import("~/messages/en/auth.json"),
    import("~/messages/en/dashboard.json"),
    import("~/messages/en/admin.json"),
    import("~/messages/en/errors.json"),
  ]);

  return {
    common: common.default,
    landing: landing.default,
    auth: auth.default,
    dashboard: dashboard.default,
    admin: admin.default,
    errors: errors.default,
  };
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;

  if (!hasLocale(routing.locales, requestedLocale)) {
    notFound();
  }

  const messages =
    requestedLocale === "es"
      ? await loadSpanishMessages()
      : await loadEnglishMessages();

  return {
    locale: requestedLocale,
    messages,
    formats: {
      number: {
        // Pattern: format.number(cents / 100, "mxnCurrency").
        mxnCurrency: {
          style: "currency",
          currency: "MXN",
        },
      },
    },
  };
});
