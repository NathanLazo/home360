import "server-only";

import {
  Prisma,
  QuoteStatus,
  RequestStatus,
  type PrismaClient,
} from "@generated/prisma";
import {
  haversineKm,
  haversineKmSql,
  type GeoPoint,
} from "~/server/services/geo/haversine";
import { approximateCoordinate } from "~/server/services/geo/approximate";
import { createDownloadUrl } from "~/server/services/media/blob";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { buildOfferDraft, type OfferDraft } from "./offer-draft";
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
// Privacy gating (MA-13): approx. 100 m precision (`approximateCoordinate`).

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
  /** Request aimed at this business only (D10-11). */
  targeted: boolean;
  expiresAt: Date | null;
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
  expiresAt: Date | null;
  targeted: boolean;
  customerName: string | null;
  distanceKm: number;
};

function toCustomerZone(
  neighborhood: string | null,
  latitude: number | null,
  longitude: number | null,
): RadarCustomerZone {
  return {
    neighborhood,
    latitude: latitude === null ? null : approximateCoordinate(latitude),
    longitude: longitude === null ? null : approximateCoordinate(longitude),
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
    targeted: row.targeted,
    expiresAt: row.expiresAt,
    customerName: row.customerName,
    zone: toCustomerZone(row.neighborhood, row.latitude, row.longitude),
    evidence,
  };
}

/**
 * OPEN or QUOTED requests (other businesses may already have offered), not
 * past `expiresAt`, without a quote from this business in any state — own
 * offers (incl. WITHDRAWN, which can be revived) live in quote.listMine.
 * Untargeted requests must sit inside the branch radius and match the
 * business catalog; requests targeted at this business (D10-11) always show,
 * requests targeted at another business never do.
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

  const distanceSql = haversineKmSql(
    origin,
    Prisma.raw('r."latitude"'),
    Prisma.raw('r."longitude"'),
  );
  // Without catalog categories only targeted requests can match.
  const openRadarSql =
    categories.length === 0
      ? Prisma.sql`FALSE`
      : Prisma.sql`(
          r."targetBusinessId" IS NULL
          AND r."category" IN (${Prisma.join(categories)})
          AND ${distanceSql} <= ${effectiveRadiusKm}
        )`;
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
      r."expiresAt",
      (r."targetBusinessId" IS NOT NULL) AS "targeted",
      u."name" AS "customerName",
      ${distanceSql} AS "distanceKm"
    FROM "ServiceRequest" AS r
    INNER JOIN "User" AS u ON u."id" = r."customerId"
    WHERE r."status"::text IN (${RequestStatus.OPEN}, ${RequestStatus.QUOTED})
      AND r."latitude" IS NOT NULL
      AND r."longitude" IS NOT NULL
      AND (r."expiresAt" IS NULL OR r."expiresAt" > NOW())
      AND (r."targetBusinessId" = ${input.businessId} OR ${openRadarSql})
      AND NOT EXISTS (
        SELECT 1
        FROM "Quote" AS q
        WHERE q."requestId" = r."id"
          AND q."businessId" = ${input.businessId}
      )
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

export type RadarOwnQuote = {
  id: string;
  status: QuoteStatus;
  amountCents: number;
  scheduledFor: Date | null;
  message: string | null;
  workerId: string | null;
  workerName: string | null;
  branchId: string | null;
  updatedAt: Date;
};

export type RadarRequestDetail = RadarRequestItem & {
  /**
   * Opaque user id of the requester: lets the pre-sale chat (D10-12) tell
   * the customer's messages from the business's. Never a contact detail.
   */
  customerId: string;
  description: string | null;
  status: RequestStatus;
  /** Whether a new/revived offer can still be sent (P-WEB-02 / N2). */
  quotable: boolean;
  /** The business's own quote on this request, if any (P-WEB-02). */
  ownQuote: RadarOwnQuote | null;
  /**
   * Smart defaults for a first offer (worker, price, slot); null once an own
   * quote exists (the form pre-fills from it) or when not quotable.
   */
  offerDraft: OfferDraft | null;
};

/**
 * Detail for N2. Visible when the request is on the radar (OPEN/QUOTED +
 * radius + category) OR the business already has a quote on it (so the
 * withdraw / re-send UI works). Returns the own quote so the client can tell
 * "no offer", "quoted" and "withdrawn" apart without inferring (P-WEB-02).
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
): Promise<ServiceResult<RadarRequestDetail>> {
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
      expiresAt: true,
      targetBusinessId: true,
      targetServiceId: true,
      suggestedServiceId: true,
      status: true,
      customerId: true,
      customer: { select: { name: true } },
      quotes: {
        where: { businessId: input.businessId },
        select: {
          id: true,
          status: true,
          amountCents: true,
          scheduledFor: true,
          message: true,
          branchId: true,
          updatedAt: true,
          worker: { select: { id: true, fullName: true } },
        },
        take: 1,
      },
    },
  });

  if (!request) {
    return svcFail("NOT_FOUND", "Request not found");
  }

  const ownQuote = request.quotes[0] ?? null;
  const openForQuotes =
    request.status === RequestStatus.OPEN ||
    request.status === RequestStatus.QUOTED;
  const onRadar =
    openForQuotes &&
    (await isRequestVisibleOnRadar(db, {
      businessId: input.businessId,
      requestId: request.id,
    }));

  if (!ownQuote && !onRadar) {
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

  const quotable =
    onRadar &&
    (ownQuote === null ||
      ownQuote.status === QuoteStatus.PENDING ||
      ownQuote.status === QuoteStatus.WITHDRAWN);

  const [evidence, offerDraft] = await Promise.all([
    signEvidence(db, {
      userId: input.userId,
      photoUrls: request.photoUrls,
    }),
    quotable && ownQuote === null
      ? buildOfferDraft(db, {
          businessId: input.businessId,
          branchId: branch.ok ? branch.data.id : null,
          request: {
            category: request.category,
            aiUrgency: request.aiUrgency,
            aiMinPriceCents: request.aiMinPriceCents,
            aiMaxPriceCents: request.aiMaxPriceCents,
            targetServiceId: request.targetServiceId,
            suggestedServiceId: request.suggestedServiceId,
          },
        })
      : Promise.resolve(null),
  ]);

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
    targeted: request.targetBusinessId !== null,
    expiresAt: request.expiresAt,
    customerName: request.customer.name,
    customerId: request.customerId,
    zone: toCustomerZone(
      request.neighborhood,
      request.latitude,
      request.longitude,
    ),
    evidence,
    status: request.status,
    quotable,
    offerDraft,
    ownQuote: ownQuote
      ? {
          id: ownQuote.id,
          status: ownQuote.status,
          amountCents: ownQuote.amountCents,
          scheduledFor: ownQuote.scheduledFor,
          message: ownQuote.message,
          workerId: ownQuote.worker?.id ?? null,
          workerName: ownQuote.worker?.fullName ?? null,
          branchId: ownQuote.branchId,
          updatedAt: ownQuote.updatedAt,
        }
      : null,
  });
}
