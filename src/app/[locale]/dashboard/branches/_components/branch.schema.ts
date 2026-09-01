import { z } from "zod";

import { BranchStatus } from "@generated/prisma";

const branchFields = {
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(160),
  managerName: z.string().trim().min(2).max(80),
  coverageRadiusKm: z.number().int().min(1).max(100),
};

export const branchIdSchema = z.object({
  id: z.string().cuid(),
});

export const branchCreateSchema = z.object({
  name: branchFields.name,
  address: branchFields.address,
  managerName: branchFields.managerName.optional(),
  coverageRadiusKm: branchFields.coverageRadiusKm,
});

export const branchUpdateSchema = branchIdSchema.extend({
  name: branchFields.name.optional(),
  address: branchFields.address.optional(),
  // `undefined` preserves the current manager; `null` explicitly clears it.
  managerName: branchFields.managerName.nullable().optional(),
  coverageRadiusKm: branchFields.coverageRadiusKm.optional(),
});

export const branchSetStatusSchema = branchIdSchema.extend({
  status: z.nativeEnum(BranchStatus),
});

export type BranchCreateInput = z.infer<typeof branchCreateSchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;
export type BranchSetStatusInput = z.infer<typeof branchSetStatusSchema>;
