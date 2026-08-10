import "server-only";

import { getTranslations } from "next-intl/server";

import type { EmailLocale } from "~/schemas/team/worker.schema";
import type {
  EmailClient,
  EmailMessage,
  EmailSendResult,
} from "~/server/services/email/email-client";

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

export type WorkerInvitationInput = {
  to: string;
  workerName: string;
  businessName: string;
  locale: EmailLocale;
};

/**
 * Sends the worker invitation. It carries no token or credential: onboarding
 * happens in the mobile app, this message only announces the assignment.
 */
export async function sendWorkerInvitation(
  emailClient: EmailClient,
  input: WorkerInvitationInput,
): Promise<EmailSendResult> {
  const t = await getTranslations({
    locale: input.locale,
    namespace: "emails.workerInvitation",
  });
  const messages = {
    subject: t("subject", { businessName: input.businessName }),
    greeting: t("greeting", { workerName: input.workerName }),
    intro: t("intro", { businessName: input.businessName }),
    instructions: t("instructions"),
    closing: t("closing"),
  };
  const paragraphs = [
    messages.greeting,
    messages.intro,
    messages.instructions,
    messages.closing,
  ];
  const message: EmailMessage = {
    to: input.to,
    subject: messages.subject,
    text: paragraphs.join("\n\n"),
    html: paragraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join(""),
  };

  return emailClient.send(message);
}
