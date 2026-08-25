import "server-only";

import { getTranslations } from "next-intl/server";

import { Prisma, type PrismaClient } from "../../../../generated/prisma";
import { env } from "~/env";
import {
  createResendEmailClientFromApiKey,
  type EmailClient,
} from "~/server/services/email/email-client";
import { haversineKmSql } from "~/server/services/geo/haversine";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

const PLATFORM_SETTINGS_ID = 1;

/** Fallback when the settings row has not been seeded yet. */
const DEFAULT_RADIUS_KM = 10;

/** Business notifications go out in the platform's default locale. */
const NOTIFICATION_LOCALE = "es";

export type NotifyNearbyResult = {
  /** ACTIVE businesses with an ACTIVE branch inside the radius that offer the request category. */
  businessIds: string[];
};

const emailClient: EmailClient | null =
  env.RESEND_API_KEY && env.EMAIL_FROM
    ? createResendEmailClientFromApiKey(env.RESEND_API_KEY, env.EMAIL_FROM)
    : null;

async function sendPush(
  db: PrismaClient,
  requestId: string,
  businessIds: string[],
): Promise<void> {
  const businesses = await db.business.findMany({
    where: { id: { in: businessIds } },
    select: { ownerId: true },
  });

  await Promise.all(
    businesses.map(({ ownerId }) =>
      sendLocalizedPushToUser(db, ownerId, {
        message: "requestNearby",
        url: `home360app://request/${requestId}`,
      }),
    ),
  );
}

/**
 * Best-effort email to the business owners; a provider failure for one
 * recipient never blocks the rest (nor the request creation, since the whole
 * service is fire-and-forget).
 */
async function sendEmails(
  db: PrismaClient,
  input: { businessIds: string[]; category: string },
): Promise<void> {
  if (!emailClient || input.businessIds.length === 0) {
    return;
  }

  const businesses = await db.business.findMany({
    where: { id: { in: input.businessIds } },
    select: { id: true, name: true, owner: { select: { email: true } } },
  });
  const t = await getTranslations({
    locale: NOTIFICATION_LOCALE,
    namespace: "emails.newRequestNearby",
  });

  for (const business of businesses) {
    const to = business.owner.email;

    if (!to) {
      continue;
    }

    try {
      await emailClient.send({
        to,
        subject: t("subject", { category: input.category }),
        text: `${t("intro", { businessName: business.name, category: input.category })}\n\n${t("cta")}`,
      });
    } catch {
      console.error(
        `[notify-request] EMAIL_DELIVERY_FAILED business ${business.id}`,
      );
    }
  }
}

/**
 * Finds the ACTIVE businesses whose catalog covers the request category and
 * that have an ACTIVE branch within `PlatformSettings.notifyNewRequestRadiusKm`
 * of the request location (Haversine evaluated in SQL), then notifies them
 * (email now, push in M7-W1). Never throws: `request.create` calls it
 * fire-and-forget and only logs the failure.
 */
export async function notifyNearbyBusinesses(
  db: PrismaClient,
  requestId: string,
): Promise<ServiceResult<NotifyNearbyResult, "INTERNAL_ERROR">> {
  try {
    const request = await db.serviceRequest.findUnique({
      where: { id: requestId },
      select: { category: true, latitude: true, longitude: true },
    });

    if (!request) {
      return svcFail("NOT_FOUND", "Request not found");
    }

    if (request.latitude === null || request.longitude === null) {
      // Nothing to match against without a location; not an error.
      return svcOk({ businessIds: [] });
    }

    const settings = await db.platformSettings.findUnique({
      where: { id: PLATFORM_SETTINGS_ID },
      select: { notifyNewRequestRadiusKm: true },
    });
    const radiusKm = settings?.notifyNewRequestRadiusKm ?? DEFAULT_RADIUS_KM;
    const origin = {
      latitude: request.latitude,
      longitude: request.longitude,
    };

    const rows = await db.$queryRaw<Array<{ businessId: string }>>(Prisma.sql`
      SELECT DISTINCT b."businessId" AS "businessId"
      FROM "Branch" AS b
      INNER JOIN "Business" AS biz ON biz."id" = b."businessId"
      WHERE b."status"::text = 'ACTIVE'
        AND biz."status"::text = 'ACTIVE'
        AND b."latitude" IS NOT NULL
        AND b."longitude" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM "Service" AS s
          WHERE s."businessId" = biz."id"
            AND s."status"::text = 'ACTIVE'
            AND s."category" = ${request.category}
        )
        AND ${haversineKmSql(
          origin,
          Prisma.raw('b."latitude"'),
          Prisma.raw('b."longitude"'),
        )} <= ${radiusKm}
    `);
    const businessIds = rows.map((row) => row.businessId);

    await sendEmails(db, { businessIds, category: request.category });
    await sendPush(db, requestId, businessIds);

    return svcOk({ businessIds });
  } catch {
    return svcFail("INTERNAL_ERROR", "Nearby business notification failed");
  }
}
