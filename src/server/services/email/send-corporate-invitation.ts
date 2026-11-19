import "server-only";

import { getTranslations } from "next-intl/server";

import type { EmailClient, EmailSendResult } from "./email-client";
import { renderEmail } from "./templates/render-email";
import type { EmailLocale } from "./templates/email-template.types";

export type CorporateInvitationInput = {
  to: string;
  companyName: string;
  /** F1-09 one-hour, single-use password link. Never logged. */
  invitationUrl: string;
  locale: EmailLocale;
};

/**
 * Sends the corporate owner invitation. The message carries the secure
 * password link and never a credential: HOME360 does not fabricate passwords
 * for anyone (same rule as the worker onboarding flow).
 */
export async function sendCorporateInvitation(
  emailClient: EmailClient,
  input: CorporateInvitationInput,
): Promise<EmailSendResult> {
  const t = await getTranslations({
    locale: input.locale,
    namespace: "emails.corporateInvitation",
  });
  const values = { companyName: input.companyName };
  const email = await renderEmail({
    locale: input.locale,
    subject: t("subject", values),
    preheader: t("preheader", values),
    eyebrow: t("eyebrow"),
    heading: t("heading"),
    paragraphs: [t("intro", values)],
    details: [{ label: t("companyLabel"), value: input.companyName }],
    action: { label: t("cta"), url: input.invitationUrl },
    notes: [t("expires"), t("closing")],
  });

  return emailClient.send({ to: input.to, ...email });
}
