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
  /**
   * Single-use acceptance link `/{locale}/invite/worker?token=…` (workstream
   * D) where the worker sets name and password. Never logged. When absent the
   * email only announces the assignment (legacy behaviour).
   */
  invitationUrl?: string;
};

/**
 * Sends the worker invitation. It never carries a credential: the optional
 * link lets the worker create their own password, and onboarding continues
 * in the mobile app with that account.
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
  const leading = [messages.greeting, messages.intro];
  const trailing = [messages.instructions, messages.closing];
  const cta = input.invitationUrl
    ? { label: t("cta"), expires: t("expires"), url: input.invitationUrl }
    : null;
  const textParagraphs = [
    ...leading,
    ...(cta ? [`${cta.label}: ${cta.url}`, cta.expires] : []),
    ...trailing,
  ];
  const htmlParagraphs = [
    ...leading.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...(cta
      ? [
          `<p><a href="${escapeHtml(cta.url)}">${escapeHtml(cta.label)}</a></p>`,
          `<p>${escapeHtml(cta.expires)}</p>`,
        ]
      : []),
    ...trailing.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
  ];
  const message: EmailMessage = {
    to: input.to,
    subject: messages.subject,
    text: textParagraphs.join("\n\n"),
    html: htmlParagraphs.join(""),
  };

  return emailClient.send(message);
}
