import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";

/**
 * What an ADMIN may impersonate, addressed by the tenant (business or
 * corporate account) instead of the owner's user id: the server resolves the
 * owner, so the client never picks an arbitrary user.
 */
export const impersonationSubjectSchema = z.enum(["BUSINESS", "CORPORATE"]);

export type ImpersonationSubject = z.infer<typeof impersonationSubjectSchema>;

export const startImpersonationSchema = z
  .object({
    subject: impersonationSubjectSchema,
    subjectId: recordIdSchema,
  })
  .strict();

export type StartImpersonationInput = z.infer<typeof startImpersonationSchema>;
