import "server-only";

import {
  Prisma,
  RequestStatus,
  type PrismaClient,
} from "@generated/prisma";
import {
  haversineKm,
  haversineKmSql,
  type GeoPoint,
} from "~/server/services/geo/haversine";
import { createDownloadUrl } from "~/server/services/media/blob";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import {
  getEffectiveRadiusKm,
  listBusinessCategories,
  resolveRadarBranch,
  isRequestVisibleOnRadar,
} from "./radar-visibility";

export {
  getEffectiveRadiusKm,
  isRequestVisibleOnRadar,
  listBusinessCategories,
  resolveRadarBranch,
} from "./radar-visibility";
export type { RadarBranch } from "./radar-visibility";

const PAGE_SIZE = 20;
/** Privacy gating (MA-13): approx. 100 m precision, never the exact pin. */
const COORD_DECIMALS = 3;

export type RadarCustomerZone = {
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RadarEvidenceItem = {
  pathname: string;
  url: string;
};

export type RadarRequestItem = {
  id: string;
  title: string;
  category: string;
  aiDiagnosis: string | null;
  aiConfidencePct: number | null;
  aiMinPriceCents: number | null;
  aiMaxPriceCents: number | null;
  aiUrgency: string | null;
  distanceKm: number;
  createdAt: Date;
  customerName: string | null;
  zone: RadarCustomerZone;
  evidence: RadarEvidenceItem[];
};

export type RadarRequestList = {
  items: RadarRequestItem[];
  nextCursor: string | null;
  branchId: string;
  effectiveRadiusKm: number;
};

type RadarRequestRow = {
  id: string;
  title: string;
  category: string;
  aiDiagnosis: string | null;
  aiConfidencePct: number | null;
  aiMinPriceCents: number | null;
  aiMaxPriceCents: number | null;
  aiUrgency: string | null;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
  photoUrls: string[];
  createdAt: Date;
  customerName: string | null;
  distanceKm: number;
};

function approximateCoord(value: number): number {
  const factor = 10 ** COORD_DECIMALS;
  return Math.round(value * factor) / factor;
}

function toCustomerZone(
  neighborhood: string | null,
  latitude: number | null,
  longitude: number | null,
): RadarCustomerZone {
  return {
    neighborhood,
    latitude: latitude === null ? null : approximateCoord(latitude),
    longitude: longitude === null ? null : approximateCoord(longitude),
  };
}

async function signEvidence(
  db: PrismaClient,
  input: { userId: string; photoUrls: string[] },
): Promise<RadarEvidenceItem[]> {
  const evidence: RadarEvidenceItem[] = [];

  for (const pathname of input.photoUrls) {
    const grant = await createDownloadUrl(db, {
      userId: input.userId,
      pathname,
    });

    if (grant.ok) {
      evidence.push({ pathname, url: grant.data.url });
    }
  }

  return evidence;
}

function toRadarItem(
  row: RadarRequestRow,
  evidence: RadarEvidenceItem[],
): RadarRequestItem {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    aiDiagnosis: row.aiDiagnosis,
    aiConfidencePct: row.aiConfidencePct,
    aiMinPriceCents: row.aiMinPriceCents,
    aiMaxPriceCents: row.aiMaxPriceCents,
    aiUrgency: row.aiUrgency,
    distanceKm: row.distanceKm,
    createdAt: row.createdAt,
    customerName: row.customerName,
    zone: toCustomerZone(row.neighborhood, row.latitude, row.longitude),
    evidence,
  };
}

/**
 * OPEN requests inside the branch radius, matching the business catalog and
 * without an existing quote from this business (including WITHDRAWN — the
 * unique pair blocks re-quoting).
 */
export async function listOpenRequests(
  db: PrismaClient,
  input: {
    businessId: string;
    userId: string;
    branchId?: string;
    cursor?: string;
  },
): Promise<ServiceResult<RadarRequestList>> {
  const branch = await resolveRadarBranch(db, {
    businessId: input.businessId,
    branchId: input.branchId,
  });

  if (!branch.ok) {
    return branch;
  }

  const categories = await listBusinessCategories(db, input.businessId);

  if (categories.length === 0) {
    return svcOk({
      items: [],
      nextCursor: null,
      branchId: branch.data.id,
      effectiveRadiusKm: await getEffectiveRadiusKm(
        db,
        branch.data.coverageRadiusKm,
      ),
    });
  }

  const effectiveRadiusKm = await getEffectiveRadiusKm(
    db,
    branch.data.coverageRadiusKm,
  );
  const origin: GeoPoint = {
    latitude: branch.data.latitude,
    longitude: branch.data.longitude,
  };

  let cursorFilter = Prisma.empty;

  if (input.cursor) {
    const cursorRow = await db.serviceRequest.findFirst({
      where: { id: input.cursor },
      select: { id: true, createdAt: true },
    });

    if (!cursorRow) {
      return svcFail("NOT_FOUND", "Cursor not found");
    }

    cursorFilter = Prisma.sql`AND (
      r."createdAt" < ${cursorRow.createdAt}
      OR (r."createdAt" = ${cursorRow.createdAt} AND r."id" < ${cursorRow.id})
    )`;
  }

  const rows = await db.$queryRaw<RadarRequestRow[]>(Prisma.sql`
    SELECT
      r."id",
      r."title",
      r."category",
      r."aiDiagnosis",
      r."aiConfidencePct",
      r."aiMinPriceCents",
      r."aiMaxPriceCents",
      r."aiUrgency"::text AS "aiUrgency",
      r."neighborhood",
      r."latitude",
      r."longitude",
      r."photoUrls",
      r."createdAt",
      u."name" AS "customerName",
      ${haversineKmSql(
        origin,
        Prisma.raw('r."latitude"'),
        Prisma.raw('r."longitude"'),
      )} AS "distanceKm"
    FROM "ServiceRequest" AS r
    INNER JOIN "User" AS u ON u."id" = r."customerId"
    WHERE r."status"::text = ${RequestStatus.OPEN}
      AND r."latitude" IS NOT NULL
      AND r."longitude" IS NOT NULL
      AND r."category" IN (${Prisma.join(categories)})
      AND NOT EXISTS (
        SELECT 1
        FROM "Quote" AS q
        WHERE q."requestId" = r."id"
          AND q."businessId" = ${input.businessId}
      )
      AND ${haversineKmSql(
        origin,
        Prisma.raw('r."latitude"'),
        Prisma.raw('r."longitude"'),
      )} <= ${effectiveRadiusKm}
      ${cursorFilter}
    ORDER BY r."createdAt" DESC, r."id" DESC
    LIMIT ${PAGE_SIZE + 1}
  `);

  const page = rows.slice(0, PAGE_SIZE);
  const items: RadarRequestItem[] = [];

  for (const row of page) {
    const evidence = await signEvidence(db, {
      userId: input.userId,
      photoUrls: row.photoUrls,
    });
    items.push(toRadarItem(row, evidence));
  }

  return svcOk({
    items,
    nextCursor: rows.length > PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    branchId: branch.data.id,
    effectiveRadiusKm,
  });
}

/**
 * Detail for N2. Visible when the request is on the radar (OPEN + radius +
 * category) OR the business already has a quote on it (so withdraw UI works).
 * Never exposes `addressLine` — only neighborhood + coords to 3 decimals.
 */
export async function getRadarRequest(
  db: PrismaClient,
  input: {
    businessId: string;
    userId: string;
    requestId: string;
    branchId?: string;
  },
): Promise<ServiceResult<RadarRequestItem & { description: string | null }>> {
  const request = await db.serviceRequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      aiDiagnosis: true,
      aiConfidencePct: true,
      aiMinPriceCents: true,
      aiMaxPriceCents: true,
      aiUrgency: true,
      neighborhood: true,
      latitude: true,
      longitude: true,
      photoUrls: true,
      createdAt: true,
      status: true,
      customer: { select: { name: true } },
      quotes: {
        where: { businessId: input.businessId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!request) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const hasOwnQuote = request.quotes.length > 0;
  const onRadar =
    request.status === RequestStatus.OPEN &&
    (await isRequestVisibleOnRadar(db, {
      businessId: input.businessId,
      requestId: request.id,
    }));

  if (!hasOwnQuote && !onRadar) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const branch = await resolveRadarBranch(db, {
    businessId: input.businessId,
    branchId: input.branchId,
  });

  const distanceKm =
    branch.ok && request.latitude !== null && request.longitude !== null
      ? haversineKm(
          {
            latitude: branch.data.latitude,
            longitude: branch.data.longitude,
          },
          {
            latitude: request.latitude,
            longitude: request.longitude,
          },
        )
      : 0;

  const evidence = await signEvidence(db, {
    userId: input.userId,
    photoUrls: request.photoUrls,
  });

  return svcOk({
    id: request.id,
    title: request.title,
    description: request.description,
    category: request.category,
    aiDiagnosis: request.aiDiagnosis,
    aiConfidencePct: request.aiConfidencePct,
    aiMinPriceCents: request.aiMinPriceCents,
    aiMaxPriceCents: request.aiMaxPriceCents,
    aiUrgency: request.aiUrgency,
    distanceKm,
    createdAt: request.createdAt,
    customerName: request.customer.name,
    zone: toCustomerZone(
      request.neighborhood,
      request.latitude,
      request.longitude,
    ),
    evidence,
  });
}
