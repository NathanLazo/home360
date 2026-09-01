import { PaymentMethod, PaymentStatus } from "@generated/prisma";
import { z } from "zod";

const MAX_PROVIDER_AMOUNT_CENTS = 50_000_000;

/**
 * Domain error codes emitted by the `payment` router on top of the shared
 * `ERROR_CODES`. They are stable literals so the UI can translate them from
 * `errors.json` without ever reading a server message.
 */
export const paymentErrorCodes = [
  "INSUFFICIENT_BALANCE",
  "NO_CONNECT_ACCOUNT",
  "PAYMENT_NOT_RELEASABLE",
  "DISPUTE_OPEN",
  "ORDER_NOT_FOUND",
  "INVALID_TARGET",
  "REFUND_EXCEEDS_LIMIT",
  "CORPORATE_PRICING_NOT_AVAILABLE",
] as const;

export type PaymentErrorCode = (typeof paymentErrorCodes)[number];

export const createPaymentLinkSchema = z.object({
  concept: z.string().trim().min(3).max(120),
  providerAmountCents: z
    .number()
    .int()
    .positive()
    .max(MAX_PROVIDER_AMOUNT_CENTS),
});

export const requestWithdrawalSchema = z.object({
  amountCents: z.number().int().positive(),
  bankName: z.string().trim().min(2).max(60),
  accountLast4: z.string().regex(/^\d{4}$/),
});

export const listTransactionsSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  cursor: z.string().cuid().optional(),
});

export const confirmDeliverySchema = z.object({
  orderId: z.string().cuid(),
});

export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;
export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;
