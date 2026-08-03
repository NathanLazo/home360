import "server-only";

import { getTranslations } from "next-intl/server";

import type {
  EmailClient,
  EmailMessage,
  EmailSendResult,
} from "./email-client";

type PasswordResetLocale = "es" | "en";

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

export async function sendPasswordReset(
  emailClient: EmailClient,
  input: { to: string; resetUrl: string; locale: PasswordResetLocale },
): Promise<EmailSendResult> {
  const t = await getTranslations({
    locale: input.locale,
    namespace: "auth.passwordResetEmail",
  });
  const messages = {
    subject: t("subject"),
    intro: t("intro"),
    cta: t("cta"),
    expires: t("expires"),
  };
  const safeUrl = escapeHtml(input.resetUrl);
  const message: EmailMessage = {
    to: input.to,
    subject: messages.subject,
    text: `${messages.intro}\n\n${messages.cta}: ${input.resetUrl}\n\n${messages.expires}`,
    html: `<p>${escapeHtml(messages.intro)}</p><p><a href="${safeUrl}">${escapeHtml(messages.cta)}</a></p><p>${escapeHtml(messages.expires)}</p>`,
  };

  return emailClient.send(message);
}
