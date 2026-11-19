import "server-only";

import { getTranslations } from "next-intl/server";

import type { EmailClient, EmailSendResult } from "./email-client";
import { renderEmail } from "./templates/render-email";
import type { EmailLocale } from "./templates/email-template.types";

export async function sendPasswordReset(
  emailClient: EmailClient,
  input: { to: string; resetUrl: string; locale: EmailLocale },
): Promise<EmailSendResult> {
  const t = await getTranslations({
    locale: input.locale,
    namespace: "auth.passwordResetEmail",
  });
  const email = await renderEmail({
    locale: input.locale,
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: t("heading"),
    paragraphs: [t("intro")],
    action: { label: t("cta"), url: input.resetUrl },
    notes: [t("expires"), t("ignore")],
  });

  return emailClient.send({ to: input.to, ...email });
}
