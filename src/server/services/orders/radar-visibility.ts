import "server-only";

import {
  BranchStatus,
  RequestStatus,
  ServiceStatus,
  type PrismaClient,
} from "../../../../generated/prisma";
import {
  haversineKm,
  type GeoPoint,
} from "~/server/services/geo/haversine";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PLATFORM_SETTINGS_ID = 1;
const DEFAULT_NOTIFY_RADIUS_KM = 10;

export type RadarBranch = {
  id: string;
  latitude: number;
  longitude: number;
  coverageRadiusKm: number;
};

/**
 * Caps the branch coverage radius with the platform notification radius
 * (MA-23): effective = min(coverageRadiusKm, notifyNewRequestRadiusKm).
 */
export async function getEffectiveRadiusKm(
  db: PrismaClient,
  coverageRadiusKm: number,
): Promise<number> {
  const settings = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: { notifyNewRequestRadiusKm: true },
  });
  const notifyRadiusKm =
    settings?.notifyNewRequestRadiusKm ?? DEFAULT_NOTIFY_RADIUS_KM;

  return Math.min(coverageRadiusKm, notifyRadiusKm);
}

/**
 * Resolves the ACTIVE branch used as radar origin. Optional `branchId` must
 * belong to the business; otherwise the first ACTIVE branch (by name) wins.
 * A missing/foreign/geo-less branch answers a generic NOT_FOUND.
 */
export async function resolveRadarBranch(
  db: PrismaClient,
  input: { businessId: string; branchId?: string },
): Promise<ServiceResult<RadarBranch>> {
  const branch = input.branchId
    ? await db.branch.findFirst({
        where: {
          id: input.branchId,
          businessId: input.businessId,
          status: BranchStatus.ACTIVE,
        },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          coverageRadiusKm: true,
        },
      })
    : await db.branch.findFirst({
        where: {
          businessId: input.businessId,
          status: BranchStatus.ACTIVE,
        },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          coverageRadiusKm: true,
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });

  if (!branch || branch.latitude === null || branch.longitude === null) {
    return svcFail("NOT_FOUND", "Branch not found");
  }

  return svcOk({
    id: branch.id,
    latitude: branch.latitude,
    longitude: branch.longitude,
    coverageRadiusKm: branch.coverageRadiusKm,
  });
}

/** ACTIVE service categories offered by the business (radar catalog gate). */
export async function listBusinessCategories(
  db: PrismaClient,
  businessId: string,
): Promise<string[]> {
  const rows = await db.service.findMany({
    where: { businessId, status: ServiceStatus.ACTIVE },
    select: { category: true },
    distinct: ["category"],
  });

  return rows.map((row) => row.category);
}

/**
 * True when the business may see the request under radar privacy rules:
 * OPEN, category in the catalog, within the effective radius of some ACTIVE
 * branch with coordinates. Used by authorizeMediaRead (MA-02) and quote.submit.
 */
export async function isRequestVisibleOnRadar(
  db: PrismaClient,
  input: { businessId: string; requestId: string },
): Promise<boolean> {
  const request = await db.serviceRequest.findFirst({
    where: {
      id: input.requestId,
      status: RequestStatus.OPEN,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      category: true,
      latitude: true,
      longitude: true,
    },
  });

  if (!request || request.latitude === null || request.longitude === null) {
    return false;
  }

  const categories = await listBusinessCategories(db, input.businessId);

  if (!categories.includes(request.category)) {
    return false;
  }

  const branches = await db.branch.findMany({
    where: {
      businessId: input.businessId,
      status: BranchStatus.ACTIVE,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      latitude: true,
      longitude: true,
      coverageRadiusKm: true,
    },
  });

  if (branches.length === 0) {
    return false;
  }

  const settings = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: { notifyNewRequestRadiusKm: true },
  });
  const notifyRadiusKm =
    settings?.notifyNewRequestRadiusKm ?? DEFAULT_NOTIFY_RADIUS_KM;

  const requestPoint: GeoPoint = {
    latitude: request.latitude,
    longitude: request.longitude,
  };

  for (const branch of branches) {
    if (branch.latitude === null || branch.longitude === null) {
      continue;
    }

    const effectiveRadiusKm = Math.min(
      branch.coverageRadiusKm,
      notifyRadiusKm,
    );
    const distanceKm = haversineKm(
      { latitude: branch.latitude, longitude: branch.longitude },
      requestPoint,
    );

    if (distanceKm <= effectiveRadiusKm) {
      return true;
    }
  }

  return false;
}
