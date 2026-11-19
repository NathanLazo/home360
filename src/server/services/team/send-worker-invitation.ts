import "server-only";

import { getTranslations } from "next-intl/server";

import type { EmailLocale } from "~/schemas/team/worker.schema";
import type {
  EmailClient,
  EmailSendResult,
} from "~/server/services/email/email-client";
import { renderEmail } from "~/server/services/email/templates/render-email";

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
  const values = { businessName: input.businessName };
  const email = await renderEmail({
    locale: input.locale,
    subject: t("subject", values),
    preheader: t("preheader", values),
    eyebrow: t("eyebrow"),
    heading: t("greeting", { workerName: input.workerName }),
    paragraphs: [t("intro", values), t("instructions")],
    details: [{ label: t("businessLabel"), value: input.businessName }],
    ...(input.invitationUrl
      ? { action: { label: t("cta"), url: input.invitationUrl } }
      : {}),
    notes: [...(input.invitationUrl ? [t("expires")] : []), t("closing")],
  });

  return emailClient.send({ to: input.to, ...email });
}
