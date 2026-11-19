import { z } from "zod";

import { ProductStatus, ServiceStatus } from "@generated/prisma";

import { recordIdSchema } from "~/schemas/record-id.schema";

export const PLATFORM_CATALOG_PAGE_SIZE = 25;

/** Filters shared by both cross-business catalog listings. */
const catalogFiltersShape = {
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .describe("Matches name, description, category or business name"),
  businessId: recordIdSchema
    .optional()
    .describe("Restrict to one business (ids from listUsers tab businesses)"),
  category: z.string().trim().min(1).max(100).optional(),
  cursor: recordIdSchema.optional().describe("nextCursor of the previous page"),
};

export const listPlatformProductsSchema = z
  .object({
    ...catalogFiltersShape,
    status: z.nativeEnum(ProductStatus).optional(),
  })
  .strict();

export type ListPlatformProductsInput = z.infer<
  typeof listPlatformProductsSchema
>;

export const listPlatformServicesSchema = z
  .object({
    ...catalogFiltersShape,
    status: z.nativeEnum(ServiceStatus).optional(),
    diagnostic: z
      .enum(["any", "configured", "credited", "not_credited", "none"])
      .default("any")
      .describe(
        "Initial diagnostic visit: configured = has a price; credited = its price is deducted from the final quote; not_credited = charged on top; none = no diagnostic",
      ),
  })
  .strict();

export type ListPlatformServicesInput = z.infer<
  typeof listPlatformServicesSchema
>;
