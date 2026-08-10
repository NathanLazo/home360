import { z } from "zod";

import type { ErrorCode } from "~/server/api/contract";

/**
 * Module error codes (F0 §4): the team module adds `EMAIL_SEND_FAILED` on top of
 * the shared contract codes. The UI translates every code from `errors.json`.
 */
export const TEAM_ERROR_CODES = ["EMAIL_SEND_FAILED"] as const;

export type TeamErrorCode = ErrorCode | (typeof TEAM_ERROR_CODES)[number];

const emailLocaleSchema = z.enum(["es", "en"]);
const fullNameSchema = z.string().trim().min(2).max(120);
const specialtySchema = z.string().trim().min(2).max(120);
const workerIdValueSchema = z.string().cuid();
const branchIdValueSchema = z.string().cuid();

export const workerIdSchema = z.object({ id: workerIdValueSchema }).strict();

export const workerCreateSchema = z
  .object({
    fullName: fullNameSchema,
    // `null` and omission both mean "no branch"; a cuid must belong to the tenant.
    branchId: branchIdValueSchema.nullish(),
    specialty: specialtySchema.optional(),
    invitedEmail: z.string().trim().toLowerCase().email().optional(),
    locale: emailLocaleSchema,
  })
  .strict();

export const workerUpdateSchema = z
  .object({
    id: workerIdValueSchema,
    fullName: fullNameSchema.optional(),
    branchId: branchIdValueSchema.nullish(),
    specialty: specialtySchema.nullish(),
  })
  .strict()
  .refine(
    (input) =>
      input.fullName !== undefined ||
      input.branchId !== undefined ||
      input.specialty !== undefined,
    { message: "At least one editable field is required" },
  );

export const workerResendInvitationSchema = z
  .object({
    id: workerIdValueSchema,
    locale: emailLocaleSchema,
  })
  .strict();

export type WorkerIdInput = z.infer<typeof workerIdSchema>;
export type WorkerCreateInput = z.infer<typeof workerCreateSchema>;
export type WorkerUpdateInput = z.infer<typeof workerUpdateSchema>;
export type WorkerResendInvitationInput = z.infer<
  typeof workerResendInvitationSchema
>;
export type EmailLocale = z.infer<typeof emailLocaleSchema>;
