import "server-only";

import { getTranslations } from "next-intl/server";

import {
  isRequestCategory,
  REQUEST_CATEGORY_MESSAGE_KEYS,
} from "~/schemas/marketplace/request-categories";
import { renderEmail } from "~/server/services/email/templates/render-email";
import type {
  EmailLocale,
  RenderedEmail,
} from "~/server/services/email/templates/email-template.types";
import type { AudienceReason } from "./request-audience";

/** i18n key and dashboard destination per audience reason. */
const REASON_COPY = {
  MATCH: { key: "match", path: "dashboard/requests" },
  ZONE: { key: "zone", path: "dashboard/services" },
  CATEGORY: { key: "category", path: "dashboard/branches" },
} as const satisfies Record<AudienceReason, { key: string; path: string }>;

export type NewRequestEmailInput = {
  locale: EmailLocale;
  appUrl: string;
  reason: AudienceReason;
  businessName: string;
  /** Stored taxonomy value (e.g. "Plomería"); localized here. */
  category: string;
};

/**
 * Builds the "new request" email for one business. The category is resolved
 * to its localized label and every message receives all its values, so no
 * ICU placeholder can leak into the delivered copy.
 */
export async function buildNewRequestEmail(
  input: NewRequestEmailInput,
): Promise<RenderedEmail> {
  const [t, tCategory] = await Promise.all([
    getTranslations({
      locale: input.locale,
      namespace: "emails.newRequestNearby",
    }),
    getTranslations({
      locale: input.locale,
      namespace: "common.serviceCategory",
    }),
  ]);
  const { key, path } = REASON_COPY[input.reason];
  const category = isRequestCategory(input.category)
    ? tCategory(REQUEST_CATEGORY_MESSAGE_KEYS[input.category])
    : input.category;
  const values = { businessName: input.businessName, category };

  return renderEmail({
    locale: input.locale,
    subject: t(`${key}.subject`, values),
    preheader: t(`${key}.preheader`, values),
    eyebrow: t("eyebrow"),
    heading: t(`${key}.heading`, values),
    paragraphs: [t(`${key}.intro`, values), t(`${key}.next`, values)],
    details: [
      { label: t("categoryLabel"), value: category },
      { label: t("matchLabel"), value: t(`${key}.matchValue`) },
    ],
    action: {
      label: t(`${key}.cta`),
      url: `${input.appUrl}/${input.locale}/${path}`,
    },
    footer: t("footer", values),
  });
}
