import { z } from "zod";

import { BranchStatus } from "@generated/prisma";

const branchFields = {
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().min(5).max(160),
  managerName: z.string().trim().min(2).max(80),
  coverageRadiusKm: z.number().int().min(1).max(100),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
};

/** Coordinates travel as a pair: one without the other is meaningless. */
function coordinatesPaired(value: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  const hasLatitude = value.latitude !== undefined && value.latitude !== null;
  const hasLongitude =
    value.longitude !== undefined && value.longitude !== null;
  return hasLatitude === hasLongitude;
}

const coordinatesPairIssue = {
  message: "Latitude and longitude must be provided together",
  path: ["longitude"],
};

export const branchIdSchema = z.object({
  id: z.string().cuid(),
});

export const branchCreateSchema = z
  .object({
    name: branchFields.name,
    address: branchFields.address,
    managerName: branchFields.managerName.optional(),
    coverageRadiusKm: branchFields.coverageRadiusKm,
    // Optional: a branch without coordinates is saved but never matched by
    // the request radar (Haversine radius needs a point).
    latitude: branchFields.latitude.optional(),
    longitude: branchFields.longitude.optional(),
  })
  .refine(coordinatesPaired, coordinatesPairIssue);

export const branchUpdateSchema = branchIdSchema
  .extend({
    name: branchFields.name.optional(),
    address: branchFields.address.optional(),
    // `undefined` preserves the current manager; `null` explicitly clears it.
    managerName: branchFields.managerName.nullable().optional(),
    coverageRadiusKm: branchFields.coverageRadiusKm.optional(),
    // Same convention: `undefined` keeps, `null` clears (both together).
    latitude: branchFields.latitude.nullable().optional(),
    longitude: branchFields.longitude.nullable().optional(),
  })
  .refine(coordinatesPaired, coordinatesPairIssue);

export const branchSetStatusSchema = branchIdSchema.extend({
  status: z.nativeEnum(BranchStatus),
});

export type BranchCreateInput = z.infer<typeof branchCreateSchema>;
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>;
export type BranchSetStatusInput = z.infer<typeof branchSetStatusSchema>;
