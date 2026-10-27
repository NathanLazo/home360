import { z } from "zod";

import { recordIdSchema } from "~/schemas/record-id.schema";

import { ServiceStatus } from "@generated/prisma";

const durationMaxSchema = z
  .number()
  .int()
  .positive()
  .max(7 * 24 * 60);

const serviceFields = {
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  basePriceCents: z.number().int().positive(),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60),
  durationMaxMinutes: durationMaxSchema.optional(),
  workerIds: z.array(recordIdSchema).max(50).default([]),
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
    category: serviceFields.category.optional(),
    basePriceCents: serviceFields.basePriceCents.optional(),
    durationMinutes: serviceFields.durationMinutes.optional(),
    durationMaxMinutes: durationMaxSchema.nullable().optional(),
    workerIds: z.array(recordIdSchema).max(50).optional(),
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
  category: z.string().trim().max(60).optional(),
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
    category: serviceFields.category,
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
