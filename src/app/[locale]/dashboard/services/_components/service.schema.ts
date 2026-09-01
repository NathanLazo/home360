import { z } from "zod";

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
  workerIds: z.array(z.string().cuid()).max(50).default([]),
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
    id: z.string().cuid(),
    name: serviceFields.name.optional(),
    category: serviceFields.category.optional(),
    basePriceCents: serviceFields.basePriceCents.optional(),
    durationMinutes: serviceFields.durationMinutes.optional(),
    durationMaxMinutes: durationMaxSchema.nullable().optional(),
    workerIds: z.array(z.string().cuid()).max(50).optional(),
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
  cursor: z.string().cuid().optional(),
});

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
export type ServiceListInput = z.infer<typeof serviceListSchema>;
