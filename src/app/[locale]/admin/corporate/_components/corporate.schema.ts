import { z } from "zod";
import { infiniteQueryDirectionSchema } from "~/schemas/pagination.schema";
import { recordIdSchema } from "~/schemas/record-id.schema";

/**
 * Shared contract for `admin.corporate` (F7-03/F7-04): the router validates
 * with these schemas and the UI reuses them, so client and server can never
 * disagree on what a valid input is.
 *
 * Enum values mirror the Prisma enums by literal value on purpose: importing
 * the generated client from a client component would drag the Prisma runtime
 * into the browser bundle.
 */
export const corporateTierSchema = z.enum([
  "BASIC",
  "STANDARD",
  "ENTERPRISE",
  "CUSTOM",
]);

export type CorporateTierValue = z.infer<typeof corporateTierSchema>;

export const corporateStatusSchema = z.enum([
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
]);

export type CorporateStatusValue = z.infer<typeof corporateStatusSchema>;

/** Status tabs of the W-corporate table; `all` removes the filter. */
export const corporateTabSchema = z.enum([
  "all",
  "active",
  "pending",
  "suspended",
  "cancelled",
]);

export type CorporateTab = z.infer<typeof corporateTabSchema>;

export const CORPORATE_TAB_STATUS: Record<
  Exclude<CorporateTab, "all">,
  CorporateStatusValue
> = {
  active: "ACTIVE",
  pending: "PENDING",
  suspended: "SUSPENDED",
  cancelled: "CANCELLED",
};

const accountIdSchema = recordIdSchema;
const commissionPctSchema = z.number().int().min(0).max(100);
const monthlyFeeCentsSchema = z.number().int().min(0);
const maxLocationsSchema = z.number().int().positive().nullable();
const emailLocaleSchema = z.enum(["es", "en"]);

/** Shared by server and dialogs so both reject the same reason input. */
export const corporateReasonSchema = z.string().trim().min(5).max(500);

export const listCorporateAccountsSchema = z
  .object({
    status: corporateStatusSchema.optional(),
    tier: corporateTierSchema.optional(),
    search: z.string().trim().max(100).optional(),
    cursor: recordIdSchema.optional(),
    direction: infiniteQueryDirectionSchema,
  })
  .strict();

export type ListCorporateAccountsInput = z.infer<
  typeof listCorporateAccountsSchema
>;

export const getCorporateAccountSchema = z
  .object({ accountId: accountIdSchema })
  .strict();

export const createCorporateAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    taxId: z.string().trim().min(2).max(20).optional(),
    ownerEmail: z.string().trim().toLowerCase().email(),
    tier: corporateTierSchema,
    // Omitted for catalog tiers means "use the CorporateTierConfig defaults".
    // CUSTOM requires them; the service enforces the per-tier ranges.
    commissionPct: commissionPctSchema.optional(),
    monthlyFeeCents: monthlyFeeCentsSchema.optional(),
    maxLocations: maxLocationsSchema.optional(),
    accountManagerId: recordIdSchema.optional(),
    locale: emailLocaleSchema,
  })
  .strict();

export type CreateCorporateAccountInput = z.infer<
  typeof createCorporateAccountSchema
>;

export const activateCorporateAccountSchema = z
  .object({ accountId: accountIdSchema })
  .strict();

export const updateCorporateTermsSchema = z
  .object({
    accountId: accountIdSchema,
    tier: corporateTierSchema,
    commissionPct: commissionPctSchema,
    monthlyFeeCents: monthlyFeeCentsSchema,
    maxLocations: maxLocationsSchema,
    accountManagerId: recordIdSchema.nullish(),
    /** Present when the change approves a pending tier-change request. */
    requestId: recordIdSchema.optional(),
  })
  .strict();

export type UpdateCorporateTermsInput = z.infer<
  typeof updateCorporateTermsSchema
>;

export const suspendCorporateAccountSchema = z
  .object({
    accountId: accountIdSchema,
    reason: corporateReasonSchema,
  })
  .strict();

export const reactivateCorporateAccountSchema = z
  .object({ accountId: accountIdSchema })
  .strict();

export const rejectTierChangeSchema = z
  .object({
    accountId: accountIdSchema,
    requestId: recordIdSchema,
    reason: corporateReasonSchema,
  })
  .strict();

export const CORPORATE_PAGE_SIZE = 20;
