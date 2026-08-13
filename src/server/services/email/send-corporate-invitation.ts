import "server-only";

import { getTranslations } from "next-intl/server";

import type {
  EmailClient,
  EmailMessage,
  EmailSendResult,
} from "~/server/services/email/email-client";

type CorporateInvitationLocale = "es" | "en";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });

export type CorporateInvitationInput = {
  to: string;
  companyName: string;
  /** F1-09 one-hour, single-use password link. Never logged. */
  invitationUrl: string;
  locale: CorporateInvitationLocale;
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
  const messages = {
    subject: t("subject", { companyName: input.companyName }),
    intro: t("intro", { companyName: input.companyName }),
    cta: t("cta"),
    expires: t("expires"),
    closing: t("closing"),
  };
  const safeUrl = escapeHtml(input.invitationUrl);
  const message: EmailMessage = {
    to: input.to,
    subject: messages.subject,
    text: `${messages.intro}\n\n${messages.cta}: ${input.invitationUrl}\n\n${messages.expires}\n\n${messages.closing}`,
    html: [
      `<p>${escapeHtml(messages.intro)}</p>`,
      `<p><a href="${safeUrl}">${escapeHtml(messages.cta)}</a></p>`,
      `<p>${escapeHtml(messages.expires)}</p>`,
      `<p>${escapeHtml(messages.closing)}</p>`,
    ].join(""),
  };

  return emailClient.send(message);
}
