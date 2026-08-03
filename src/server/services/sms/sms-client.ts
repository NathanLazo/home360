import "server-only";

export type SmsMessage = {
  to: string;
  body: string;
};

export type SmsSendResult = {
  providerMessageId: string;
};

export type SmsClient = {
  send(message: SmsMessage): Promise<SmsSendResult>;
};

export type SendDmTransport = {
  send(input: {
    from: string;
    to: string;
    message: string;
  }): Promise<{ id: string }>;
};

export function createSendDmSmsClient(
  transport: SendDmTransport,
  from: string,
): SmsClient {
  return {
    async send(message) {
      const result = await transport.send({
        from,
        to: message.to,
        message: message.body,
      });

      return { providerMessageId: result.id };
    },
  };
}
