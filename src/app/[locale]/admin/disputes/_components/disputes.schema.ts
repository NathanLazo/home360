import { z } from "zod";

import { DisputeResolution, DisputeUrgency } from "@generated/prisma";

/**
 * "open" folds OPEN and IN_REVIEW: both are still on the admin's desk.
 * "in_review" narrows to files waiting on more evidence; "all" drops the gate.
 */
export const DISPUTE_FILTERS = [
  "open",
  "in_review",
  "resolved",
  "all",
] as const;

export const disputeFilterSchema = z.enum(DISPUTE_FILTERS);

export type DisputeFilter = z.infer<typeof disputeFilterSchema>;

export const disputeUrgencyFilterSchema = z.nativeEnum(DisputeUrgency);

export const DISPUTE_SEARCH_MAX_LENGTH = 100;

export const listDisputesSchema = z
  .object({
    status: disputeFilterSchema.optional(),
    urgency: disputeUrgencyFilterSchema.optional(),
    /** Order folio (digits, optional "#") or a party / title fragment. */
    search: z.string().trim().max(DISPUTE_SEARCH_MAX_LENGTH).optional(),
    cursor: z.string().cuid().optional(),
  })
  .strict();

export type ListDisputesInput = z.infer<typeof listDisputesSchema>;

export const getDisputeSchema = z
  .object({ disputeId: z.string().cuid() })
  .strict();

export const MIN_JUSTIFICATION_LENGTH = 20;

export const EVIDENCE_NOTE_MIN_LENGTH = 10;
export const EVIDENCE_NOTE_MAX_LENGTH = 1000;

/** "Pedir más evidencia": the admin must say what evidence is missing. */
export const requestDisputeEvidenceSchema = z
  .object({
    disputeId: z.string().cuid(),
    note: z
      .string()
      .trim()
      .min(EVIDENCE_NOTE_MIN_LENGTH)
      .max(EVIDENCE_NOTE_MAX_LENGTH),
  })
  .strict();

export type RequestDisputeEvidenceInput = z.infer<
  typeof requestDisputeEvidenceSchema
>;

export const generateDisputeSummarySchema = getDisputeSchema;

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
