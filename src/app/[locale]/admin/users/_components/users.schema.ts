import { z } from "zod";

import { WorkerAvailability } from "@generated/prisma";
import { planCodeSchema } from "~/lib/subscription/plan-codes";
import { recordIdSchema } from "~/schemas/record-id.schema";
import { infiniteQueryDirectionSchema } from "~/schemas/pagination.schema";

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

/** Platform access of a CUSTOMER/WORKER user (`User.suspendedAt`). */
export const userAccessStatusSchema = z.enum(["active", "suspended"]);

export type UserAccessStatus = z.infer<typeof userAccessStatusSchema>;

export const workerAvailabilitySchema = z.nativeEnum(WorkerAvailability);

export type WorkerAvailabilityValue = z.infer<typeof workerAvailabilitySchema>;

/** Filters shared by the paginated list and the CSV export. */
const usersFiltersShape = {
  tab: usersTabSchema,
  search: z.string().trim().max(100).optional(),
  /** Businesses tab only. */
  status: businessDerivedStatusSchema.optional(),
  /** Customers tab only. */
  accessStatus: userAccessStatusSchema.optional(),
  /** Workers tab only. */
  availability: workerAvailabilitySchema.optional(),
};

export const listUsersSchema = z
  .object({
    ...usersFiltersShape,
    cursor: recordIdSchema.optional(),
    direction: infiniteQueryDirectionSchema,
  })
  .strict();

export type ListUsersInput = z.infer<typeof listUsersSchema>;

export type UsersFiltersInput = Omit<ListUsersInput, "cursor">;

export const getBusinessDetailSchema = z
  .object({ businessId: recordIdSchema })
  .strict();

/** The export honors the very filters on screen, never the whole table. */
export const exportUsersCsvSchema = z.object(usersFiltersShape).strict();

/** Shared by the server and the dialogs so both reject the same input. */
export const moderationReasonSchema = z.string().trim().min(5).max(500);

export const approveBusinessSchema = z
  .object({
    businessId: recordIdSchema,
    planCode: planCodeSchema,
  })
  .strict();

export type ApproveBusinessInput = z.infer<typeof approveBusinessSchema>;

export const rejectBusinessSchema = z
  .object({
    businessId: recordIdSchema,
    reason: moderationReasonSchema,
  })
  .strict();

export const suspendBusinessSchema = z
  .object({
    businessId: recordIdSchema,
    reason: moderationReasonSchema,
  })
  .strict();

export const reactivateBusinessSchema = z
  .object({ businessId: recordIdSchema })
  .strict();

/** A REJECTED business goes back to the PENDING review queue. */
export const reopenBusinessReviewSchema = z
  .object({ businessId: recordIdSchema })
  .strict();

/**
 * Approving a document may carry an optional note; rejecting one always
 * explains why, so the business knows what to upload again.
 */
export const reviewDocumentSchema = z.discriminatedUnion("status", [
  z
    .object({
      documentId: recordIdSchema,
      status: z.literal("APPROVED"),
      notes: moderationReasonSchema.optional(),
    })
    .strict(),
  z
    .object({
      documentId: recordIdSchema,
      status: z.literal("REJECTED"),
      notes: moderationReasonSchema,
    })
    .strict(),
]);

export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;

export const getCustomerDetailSchema = z
  .object({ userId: recordIdSchema })
  .strict();

export const suspendUserSchema = z
  .object({
    userId: recordIdSchema,
    reason: moderationReasonSchema,
  })
  .strict();

export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

export const reactivateUserSchema = z
  .object({ userId: recordIdSchema })
  .strict();

export type ReactivateUserInput = z.infer<typeof reactivateUserSchema>;

/** Sections of the business sheet a deep link can focus. */
export const businessSheetSectionSchema = z.enum(["documents"]);

export type BusinessSheetSection = z.infer<typeof businessSheetSectionSchema>;

/** Dialog a deep link may open on arrival (W9 → W10 "approve"). */
export const businessDeepLinkActionSchema = z.enum(["approve"]);

export const USERS_PAGE_SIZE = 20;

export const USERS_CSV_ROW_CAP = 5000;
