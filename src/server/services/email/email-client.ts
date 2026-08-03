import "server-only";

import { Resend } from "resend";

export type EmailMessage = {
  to: string | readonly string[];
  subject: string;
  text?: string;
  html?: string;
};

export type EmailSendResult = {
  providerMessageId: string;
};

export type EmailClient = {
  send(message: EmailMessage): Promise<EmailSendResult>;
};

export function createResendEmailClient(
  resend: Resend,
  from: string,
): EmailClient {
  return {
    async send(message) {
      const to = typeof message.to === "string" ? message.to : [...message.to];
      const baseMessage = {
        from,
        to,
        subject: message.subject,
      };

      const response =
        message.html !== undefined
          ? await resend.emails.send({
              ...baseMessage,
              html: message.html,
              ...(message.text !== undefined ? { text: message.text } : {}),
            })
          : message.text !== undefined
            ? await resend.emails.send({
                ...baseMessage,
                text: message.text,
              })
            : undefined;

      if (!response || response.error || !response.data?.id) {
        throw new Error("Email delivery failed");
      }

      return { providerMessageId: response.data.id };
    },
  };
}

export function createResendEmailClientFromApiKey(
  apiKey: string,
  from: string,
): EmailClient {
  return createResendEmailClient(new Resend(apiKey), from);
}
