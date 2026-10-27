import type { Formats } from "next-intl";

/**
 * Named formats shared by the request config (server) and the app formatter
 * (`useAppFormatter` / `getAppFormatter`). Prefer a name over inline options
 * so every table prints the same shape.
 */
export const appFormats = {
  number: {
    // Pattern: format.number(cents / 100, "mxnCurrency") -> "$1,200.00".
    mxnCurrency: {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  },
  dateTime: {
    // "5 sept 2026" (es-MX) / "Sep 5, 2026" (en-US): numeric day, never
    // zero-padded, so rows in a list line up the same way.
    shortDate: {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
    // "5 sept 2026, 14:30" / "Sep 5, 2026, 2:30 PM".
    shortDateTime: {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  },
} as const satisfies Formats;
