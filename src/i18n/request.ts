import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "./routing";

async function loadSpanishMessages() {
  const [
    common,
    landing,
    auth,
    dashboard,
    admin,
    corporate,
    errors,
    emails,
    push,
    agent,
    profile,
  ] = await Promise.all([
    import("~/messages/es/common.json"),
    import("~/messages/es/landing.json"),
    import("~/messages/es/auth.json"),
    import("~/messages/es/dashboard.json"),
    import("~/messages/es/admin.json"),
    import("~/messages/es/corporate.json"),
    import("~/messages/es/errors.json"),
    import("~/messages/es/emails.json"),
    import("~/messages/es/push.json"),
    import("~/messages/es/agent.json"),
    import("~/messages/es/profile.json"),
  ]);

  return {
    common: common.default,
    landing: landing.default,
    auth: auth.default,
    dashboard: dashboard.default,
    admin: admin.default,
    corporate: corporate.default,
    errors: errors.default,
    emails: emails.default,
    push: push.default,
    agent: agent.default,
    profile: profile.default,
  };
}

async function loadEnglishMessages() {
  const [
    common,
    landing,
    auth,
    dashboard,
    admin,
    corporate,
    errors,
    emails,
    push,
    agent,
    profile,
  ] = await Promise.all([
    import("~/messages/en/common.json"),
    import("~/messages/en/landing.json"),
    import("~/messages/en/auth.json"),
    import("~/messages/en/dashboard.json"),
    import("~/messages/en/admin.json"),
    import("~/messages/en/corporate.json"),
    import("~/messages/en/errors.json"),
    import("~/messages/en/emails.json"),
    import("~/messages/en/push.json"),
    import("~/messages/en/agent.json"),
    import("~/messages/en/profile.json"),
  ]);

  return {
    common: common.default,
    landing: landing.default,
    auth: auth.default,
    dashboard: dashboard.default,
    admin: admin.default,
    corporate: corporate.default,
    errors: errors.default,
    emails: emails.default,
    push: push.default,
    agent: agent.default,
    profile: profile.default,
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
