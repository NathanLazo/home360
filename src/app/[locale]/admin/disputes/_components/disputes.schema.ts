import { z } from "zod";

import { DisputeResolution } from "@generated/prisma";

/** "open" folds OPEN and IN_REVIEW: both are still on the admin's desk. */
export const disputeFilterSchema = z.enum(["open", "resolved"]);

export type DisputeFilter = z.infer<typeof disputeFilterSchema>;

export const listDisputesSchema = z
  .object({
    status: disputeFilterSchema.optional(),
    cursor: z.string().cuid().optional(),
  })
  .strict();

export const getDisputeSchema = z
  .object({ disputeId: z.string().cuid() })
  .strict();

export const MIN_JUSTIFICATION_LENGTH = 20;

/**
 * A partial refund states principal and service fee separately, even when one
 * of them is zero: `PENDIENTES.md` §6 forbids inferring or prorating the flat
 * service fee from an opaque amount.
 */
export const resolveDisputeSchema = z
  .object({
    disputeId: z.string().cuid(),
    resolution: z.nativeEnum(DisputeResolution),
    providerRefundCents: z.number().int().nonnegative().optional(),
    serviceFeeRefundCents: z.number().int().nonnegative().optional(),
    justification: z
      .string()
      .trim()
      .min(MIN_JUSTIFICATION_LENGTH)
      .max(1000)
      .optional(),
  })
  .strict();

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;

export const DISPUTES_PAGE_SIZE = 20;
