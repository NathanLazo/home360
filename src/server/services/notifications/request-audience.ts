import "server-only";

import { Prisma, type PrismaClient } from "@generated/prisma";
import { toRequestCategory } from "~/schemas/marketplace/request-category-match";
import type { GeoPoint } from "~/server/services/geo/haversine";
import { haversineKmSql } from "~/server/services/geo/haversine";

const PLATFORM_SETTINGS_ID = 1;

/** Fallback when the settings row has not been seeded yet. */
const DEFAULT_RADIUS_CAP_KM = 10;

/**
 * Category-only matches (business outside its own coverage) are bounded to
 * the metro area so a single request never fans out nationwide.
 */
export const CATEGORY_OUTREACH_MAX_KM = 50;

/**
 * Why a business is told about a new request:
 * - MATCH: inside its coverage AND its catalog covers the category (can quote).
 * - ZONE: inside its coverage, category not in its catalog yet.
 * - CATEGORY: its catalog covers the category, request outside its coverage.
 */
export type AudienceReason = "MATCH" | "ZONE" | "CATEGORY";

export type AudienceMember = {
  businessId: string;
  reason: AudienceReason;
};

type AudienceRow = {
  businessId: string;
  inZone: boolean;
  categoryMatch: boolean;
};

function toReason(row: AudienceRow): AudienceReason {
  if (row.inZone) {
    return row.categoryMatch ? "MATCH" : "ZONE";
  }

  return "CATEGORY";
}

/**
 * Free-text catalog categories (legacy services, products) that map to the
 * request category through the canonical aliases.
 */
async function matchingFreeTextCategories(
  db: PrismaClient,
  category: string,
): Promise<{ services: string[]; products: string[] }> {
  const [legacyServices, products] = await Promise.all([
    db.service.findMany({
      where: { status: "ACTIVE", categories: { isEmpty: true } },
      select: { category: true },
      distinct: ["category"],
    }),
    db.product.findMany({
      where: { status: "PUBLISHED" },
      select: { category: true },
      distinct: ["category"],
    }),
  ]);
  const matches = (rows: Array<{ category: string }>): string[] =>
    rows
      .map((row) => row.category)
      .filter((value) => toRequestCategory(value) === category);

  return { services: matches(legacyServices), products: matches(products) };
}

function inListSql(column: Prisma.Sql, values: string[]): Prisma.Sql {
  return values.length === 0
    ? Prisma.sql`FALSE`
    : Prisma.sql`${column} IN (${Prisma.join(values)})`;
}

/**
 * ACTIVE businesses with an ACTIVE geocoded STORE branch that either cover
 * the request point with their own `coverageRadiusKm` (capped by
 * `PlatformSettings.notifyNewRequestRadiusKm`, same effective radius as the
 * radar) or offer the request category (services or published products)
 * within `CATEGORY_OUTREACH_MAX_KM`. Blocked customer×business pairs are
 * excluded. Haversine runs in SQL.
 */
export async function findRequestAudience(
  db: PrismaClient,
  input: { customerId: string; category: string; point: GeoPoint },
): Promise<AudienceMember[]> {
  const settings = await db.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: { notifyNewRequestRadiusKm: true },
  });
  const radiusCapKm =
    settings?.notifyNewRequestRadiusKm ?? DEFAULT_RADIUS_CAP_KM;
  const freeText = await matchingFreeTextCategories(db, input.category);
  const distanceSql = haversineKmSql(
    input.point,
    Prisma.raw('b."latitude"'),
    Prisma.raw('b."longitude"'),
  );

  const rows = await db.$queryRaw<AudienceRow[]>(Prisma.sql`
    SELECT
      d."businessId" AS "businessId",
      BOOL_OR(d."distanceKm" <= LEAST(d."coverageRadiusKm", ${radiusCapKm})) AS "inZone",
      BOOL_OR(d."categoryMatch") AS "categoryMatch"
    FROM (
      SELECT
        b."businessId",
        b."coverageRadiusKm",
        ${distanceSql} AS "distanceKm",
        (
          EXISTS (
            SELECT 1 FROM "Service" AS s
            WHERE s."businessId" = biz."id"
              AND s."status"::text = 'ACTIVE'
              AND (
                ${input.category} = ANY(s."categories")
                OR (
                  cardinality(s."categories") = 0
                  AND ${inListSql(Prisma.raw('s."category"'), freeText.services)}
                )
              )
          )
          OR EXISTS (
            SELECT 1 FROM "Product" AS p
            WHERE p."businessId" = biz."id"
              AND p."status"::text = 'PUBLISHED'
              AND ${inListSql(Prisma.raw('p."category"'), freeText.products)}
          )
        ) AS "categoryMatch"
      FROM "Branch" AS b
      INNER JOIN "Business" AS biz ON biz."id" = b."businessId"
      WHERE b."status"::text = 'ACTIVE'
        AND b."kind"::text = 'STORE'
        AND biz."status"::text = 'ACTIVE'
        AND b."latitude" IS NOT NULL
        AND b."longitude" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "CustomerBusinessBlock" AS cb
          WHERE cb."businessId" = biz."id"
            AND cb."customerId" = ${input.customerId}
        )
    ) AS d
    GROUP BY d."businessId"
    HAVING
      BOOL_OR(d."distanceKm" <= LEAST(d."coverageRadiusKm", ${radiusCapKm}))
      OR (
        BOOL_OR(d."categoryMatch")
        AND MIN(d."distanceKm") <= ${CATEGORY_OUTREACH_MAX_KM}
      )
  `);

  return rows.map((row) => ({
    businessId: row.businessId,
    reason: toReason(row),
  }));
}
