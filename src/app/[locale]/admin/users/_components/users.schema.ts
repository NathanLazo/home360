import { z } from "zod";

import { planCodeSchema } from "~/lib/subscription/plan-codes";

export const usersTabSchema = z.enum(["businesses", "customers", "workers"]);

export type UsersTab = z.infer<typeof usersTabSchema>;

/**
 * "In dispute" is a derived state, not a `BusinessStatus`: it only applies to
 * an ACTIVE business with at least one unresolved dispute.
 */
export const businessDerivedStatusSchema = z.enum([
  "active",
  "pending",
  "suspended",
  "rejected",
  "in_dispute",
]);

export type BusinessDerivedStatus = z.infer<typeof businessDerivedStatusSchema>;

export const listUsersSchema = z
  .object({
    tab: usersTabSchema,
    search: z.string().trim().max(100).optional(),
    status: businessDerivedStatusSchema.optional(),
    cursor: z.string().cuid().optional(),
  })
  .strict();

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export const getBusinessDetailSchema = z
  .object({ businessId: z.string().cuid() })
  .strict();

export const exportUsersCsvSchema = z.object({ tab: usersTabSchema }).strict();

/** Shared by the server and the dialogs so both reject the same input. */
export const moderationReasonSchema = z.string().trim().min(5).max(500);

export const approveBusinessSchema = z
  .object({
    businessId: z.string().cuid(),
    planCode: planCodeSchema,
  })
  .strict();

export type ApproveBusinessInput = z.infer<typeof approveBusinessSchema>;

export const rejectBusinessSchema = z
  .object({
    businessId: z.string().cuid(),
    reason: moderationReasonSchema,
  })
  .strict();

export const suspendBusinessSchema = z
  .object({
    businessId: z.string().cuid(),
    reason: moderationReasonSchema,
  })
  .strict();

export const reactivateBusinessSchema = z
  .object({ businessId: z.string().cuid() })
  .strict();

export const USERS_PAGE_SIZE = 20;

export const USERS_CSV_ROW_CAP = 5000;
