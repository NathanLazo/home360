import { z } from "zod";

import { REQUEST_CATEGORIES } from "~/schemas/marketplace/request-categories";
import { recordIdSchema } from "~/schemas/record-id.schema";

import { ServiceStatus } from "@generated/prisma";

const durationMaxSchema = z
  .number()
  .int()
  .positive()
  .max(7 * 24 * 60);

export const SERVICE_CATEGORIES_MAX = 8;

/** One or more categories of the fixed marketplace taxonomy, deduplicated. */
const serviceCategoriesSchema = z
  .array(z.enum(REQUEST_CATEGORIES))
  .min(1)
  .max(SERVICE_CATEGORIES_MAX)
  .transform((categories) => [...new Set(categories)]);

const serviceFields = {
  name: z.string().trim().min(2).max(120),
  categories: serviceCategoriesSchema,
  basePriceCents: z.number().int().positive(),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60),
  durationMaxMinutes: durationMaxSchema.optional(),
  workerIds: z.array(recordIdSchema).max(50).default([]),
  description: z.string().trim().min(1).max(1_000).optional(),
  // Public catalog image (Service.imageUrl): HTTPS only, like products.
  imageUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => value.startsWith("https://"))
    .optional(),
};

export const serviceCreateSchema = z
  .object(serviceFields)
  .refine(
    (value) =>
      value.durationMaxMinutes === undefined ||
      value.durationMaxMinutes >= value.durationMinutes,
    { path: ["durationMaxMinutes"] },
  );

export const serviceUpdateSchema = z
  .object({
    id: recordIdSchema,
    name: serviceFields.name.optional(),
    categories: serviceFields.categories.optional(),
    basePriceCents: serviceFields.basePriceCents.optional(),
    durationMinutes: serviceFields.durationMinutes.optional(),
    durationMaxMinutes: durationMaxSchema.nullable().optional(),
    workerIds: z.array(recordIdSchema).max(50).optional(),
    // `undefined` keeps the current value; `null` removes it.
    description: serviceFields.description.unwrap().nullable().optional(),
    imageUrl: serviceFields.imageUrl.unwrap().nullable().optional(),
  })
  .refine(
    (value) =>
      value.durationMinutes === undefined ||
      value.durationMaxMinutes === undefined ||
      value.durationMaxMinutes === null ||
      value.durationMaxMinutes >= value.durationMinutes,
    { path: ["durationMaxMinutes"] },
  );

export const serviceListSchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  category: z.enum(REQUEST_CATEGORIES).optional(),
  status: z.nativeEnum(ServiceStatus).optional(),
  cursor: recordIdSchema.optional(),
});

export const serviceImportErrorCodes = [
  "SERVICE_INVALID_NAME",
  "SERVICE_INVALID_CATEGORY",
  "SERVICE_INVALID_PRICE",
  "SERVICE_INVALID_DURATION",
  "SERVICE_INVALID_DURATION_MAX",
  "SERVICE_UNKNOWN_WORKER",
  "DUPLICATE_NAME_IN_FILE",
] as const;

export type ServiceImportErrorCode = (typeof serviceImportErrorCodes)[number];

/**
 * One spreadsheet row of a bulk service load. `workerNames` are matched by
 * full name or invitation email inside the business; `undefined` keeps the
 * workers of an existing service untouched.
 */
export const serviceImportRowSchema = z
  .object({
    line: z.number().int().positive(),
    name: serviceFields.name,
    categories: serviceFields.categories,
    basePriceCents: serviceFields.basePriceCents,
    durationMinutes: serviceFields.durationMinutes,
    durationMaxMinutes: durationMaxSchema.optional(),
    workerNames: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  })
  .refine(
    (value) =>
      value.durationMaxMinutes === undefined ||
      value.durationMaxMinutes >= value.durationMinutes,
    { path: ["durationMaxMinutes"] },
  );

export const serviceImportSchema = z.object({
  rows: z.array(serviceImportRowSchema).min(1).max(500),
});

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
export type ServiceListInput = z.infer<typeof serviceListSchema>;
export type ServiceImportRow = z.infer<typeof serviceImportRowSchema>;
export type ServiceImportError = { line: number; code: ServiceImportErrorCode };
