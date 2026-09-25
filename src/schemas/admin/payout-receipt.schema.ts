import { z } from "zod";

import { infiniteQueryDirectionSchema } from "~/schemas/pagination.schema";
import { recordIdSchema } from "~/schemas/record-id.schema";

/** Receipts are proofs of payment: photos, scans or the bank's PDF voucher. */
export const PAYOUT_RECEIPT_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const PAYOUT_RECEIPT_MAX_FILES = 10;

export const PAYOUT_RECEIPT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** Base64 grows ~4/3 over the binary size; small slack for padding. */
const MAX_BASE64_CHARS = Math.ceil((PAYOUT_RECEIPT_MAX_SIZE_BYTES * 4) / 3) + 8;

export const payoutReceiptContentTypeSchema = z.enum(
  PAYOUT_RECEIPT_CONTENT_TYPES,
);

export type PayoutReceiptContentType =
  (typeof PAYOUT_RECEIPT_CONTENT_TYPES)[number];

export const payoutReceiptFileSchema = z
  .object({
    filename: z.string().trim().min(1).max(200),
    contentType: payoutReceiptContentTypeSchema,
    /** Raw file content; only ever travels server-side (agent tool → tRPC caller). */
    dataBase64: z.string().min(1).max(MAX_BASE64_CHARS),
  })
  .strict();

/** Exactly one payout target: a withdrawal or a loyalty bonus. */
function hasExactlyOneTarget(input: {
  withdrawalId?: string;
  loyaltyBonusId?: string;
}): boolean {
  return (
    (input.withdrawalId === undefined) !== (input.loyaltyBonusId === undefined)
  );
}

export const registerPayoutReceiptsSchema = z
  .object({
    withdrawalId: recordIdSchema.optional(),
    loyaltyBonusId: recordIdSchema.optional(),
    notes: z.string().trim().max(500).optional(),
    files: z
      .array(payoutReceiptFileSchema)
      .min(1)
      .max(PAYOUT_RECEIPT_MAX_FILES),
  })
  .strict()
  .refine(hasExactlyOneTarget, {
    message: "Exactly one of withdrawalId or loyaltyBonusId is required",
  });

export type RegisterPayoutReceiptsInput = z.infer<
  typeof registerPayoutReceiptsSchema
>;

export const listPayoutReceiptsSchema = z
  .object({
    withdrawalId: recordIdSchema.optional(),
    loyaltyBonusId: recordIdSchema.optional(),
    businessId: recordIdSchema.optional(),
    cursor: recordIdSchema.optional(),
    direction: infiniteQueryDirectionSchema,
  })
  .strict();

export type ListPayoutReceiptsInput = z.infer<typeof listPayoutReceiptsSchema>;

export const getPayoutReceiptUrlSchema = z
  .object({ receiptId: recordIdSchema })
  .strict();

export const PAYOUT_RECEIPTS_PAGE_SIZE = 20;
