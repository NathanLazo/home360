import { z } from "zod";

import { CorporateTier, OrderStatus } from "@generated/prisma";
import { DISPUTE_REASONS } from "~/schemas/disputes/dispute-reasons";
import { REQUEST_CATEGORIES } from "~/schemas/marketplace/request-categories";

/**
 * Shared Zod schemas for the corporate dashboard (F7-05). The router validates
 * with these and the UI reuses the same inputs, so both sides agree on limits
 * without a parallel definition.
 */

/** Calendar month in the business time zone, e.g. "2026-08". */
export const corporateMonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const corporateOverviewSchema = z.object({
  month: corporateMonthSchema.optional(),
  locationId: z.string().cuid().optional(),
});

export const corporateOrderListSchema = z.object({
  locationId: z.string().cuid().optional(),
  status: z.nativeEnum(OrderStatus).optional(),
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const corporateLocationListSchema = z.object({
  includeInactive: z.boolean().optional(),
});

const locationFields = {
  name: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  contactName: z.string().trim().min(2).max(80),
  contactPhone: z.string().trim().min(7).max(20),
};

export const corporateLocationCreateSchema = z.object({
  name: locationFields.name,
  addressLine: locationFields.addressLine,
  city: locationFields.city,
  contactName: locationFields.contactName.optional(),
  contactPhone: locationFields.contactPhone.optional(),
});

export const corporateLocationIdSchema = z.object({
  locationId: z.string().cuid(),
});

export const corporateLocationUpdateSchema = corporateLocationIdSchema.extend({
  name: locationFields.name.optional(),
  addressLine: locationFields.addressLine.optional(),
  city: locationFields.city.optional(),
  // `undefined` keeps the current contact; `null` explicitly clears it.
  contactName: locationFields.contactName.nullable().optional(),
  contactPhone: locationFields.contactPhone.nullable().optional(),
});

export const corporateInvoiceListSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const corporateTierChangeRequestSchema = z.object({
  tier: z.nativeEnum(CorporateTier),
  notes: z.string().trim().min(1).max(500).optional(),
});

export type CorporateOverviewInput = z.infer<typeof corporateOverviewSchema>;

/** Corporate consumer flow (workstream D): request → quotes → order. */
export const corporateRequestCreateSchema = z.object({
  corporateLocationId: z.string().cuid(),
  category: z.enum(REQUEST_CATEGORIES),
  description: z.string().trim().min(10).max(1_000),
  mediaPathnames: z.array(z.string().trim().min(1).max(500)).max(5).default([]),
});

export const corporateRequestListSchema = z.object({
  locationId: z.string().cuid().optional(),
  cursor: z.string().cuid().optional(),
});

export const corporateRequestIdSchema = z.object({
  requestId: z.string().cuid(),
});

export const corporateQuoteIdSchema = z.object({
  quoteId: z.string().cuid(),
});

export const corporateOrderIdSchema = z.object({
  orderId: z.string().cuid(),
});

export const corporateReworkSchema = corporateOrderIdSchema.extend({
  note: z.string().trim().min(10).max(1_000),
});

export const corporateOpenDisputeSchema = corporateOrderIdSchema.extend({
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().trim().min(20).max(2_000),
});

export type CorporateRequestCreateInput = z.infer<
  typeof corporateRequestCreateSchema
>;
export type CorporateRequestListInput = z.infer<
  typeof corporateRequestListSchema
>;
export type CorporateOrderListInput = z.infer<typeof corporateOrderListSchema>;
export type CorporateLocationListInput = z.infer<
  typeof corporateLocationListSchema
>;
export type CorporateLocationCreateInput = z.infer<
  typeof corporateLocationCreateSchema
>;
export type CorporateLocationUpdateInput = z.infer<
  typeof corporateLocationUpdateSchema
>;
export type CorporateLocationIdInput = z.infer<
  typeof corporateLocationIdSchema
>;
export type CorporateInvoiceListInput = z.infer<
  typeof corporateInvoiceListSchema
>;
export type CorporateTierChangeRequestInput = z.infer<
  typeof corporateTierChangeRequestSchema
>;
