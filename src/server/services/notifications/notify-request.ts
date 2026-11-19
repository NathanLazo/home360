import "server-only";

import { getTranslations } from "next-intl/server";

import type { PrismaClient } from "@generated/prisma";
import { env } from "~/env";
import {
  createResendEmailClientFromApiKey,
  type EmailClient,
} from "~/server/services/email/email-client";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import {
  findRequestAudience,
  type AudienceMember,
  type AudienceReason,
} from "./request-audience";

/** Business notifications go out in the platform's default locale. */
const NOTIFICATION_LOCALE = "es";

export type NotifyNearbyResult = {
  /** Every notified business with the reason it was told about the request. */
  audience: AudienceMember[];
};

const emailClient: EmailClient | null =
  env.RESEND_API_KEY && env.EMAIL_FROM
    ? createResendEmailClientFromApiKey(env.RESEND_API_KEY, env.EMAIL_FROM)
    : null;

/** i18n key per reason under `emails.newRequestNearby`. */
const REASON_KEY = {
  MATCH: "match",
  ZONE: "zone",
  CATEGORY: "category",
} as const satisfies Record<AudienceReason, string>;

/**
 * Push only for MATCH: it is the only reason whose deep link lands on a
 * request the business can actually see and quote on the radar.
 */
async function sendPush(
  db: PrismaClient,
  requestId: string,
  audience: AudienceMember[],
): Promise<void> {
  const businessIds = audience
    .filter((member) => member.reason === "MATCH")
    .map((member) => member.businessId);

  if (businessIds.length === 0) {
    return;
  }

  const businesses = await db.business.findMany({
    where: { id: { in: businessIds } },
    select: { ownerId: true },
  });

  await Promise.allSettled(
    businesses.map(({ ownerId }) =>
      sendLocalizedPushToUser(db, ownerId, {
        message: "requestNearby",
        url: `home360app://request/${requestId}`,
      }),
    ),
  );
}

/**
 * Best-effort email to each business owner, worded by reason; a provider
 * failure for one recipient never blocks the rest (nor the request creation,
 * since the whole service is fire-and-forget).
 */
async function sendEmails(
  db: PrismaClient,
  input: { audience: AudienceMember[]; category: string },
): Promise<void> {
  if (!emailClient || input.audience.length === 0) {
    return;
  }

  const reasonById = new Map(
    input.audience.map((member) => [member.businessId, member.reason]),
  );
  const businesses = await db.business.findMany({
    where: { id: { in: [...reasonById.keys()] } },
    select: { id: true, name: true, owner: { select: { email: true } } },
  });
  const t = await getTranslations({
    locale: NOTIFICATION_LOCALE,
    namespace: "emails.newRequestNearby",
  });

  for (const business of businesses) {
    const to = business.owner.email;
    const reason = reasonById.get(business.id);

    if (!to || !reason) {
      continue;
    }

    const key = REASON_KEY[reason];
    const values = { businessName: business.name, category: input.category };

    try {
      await emailClient.send({
        to,
        subject: t(`${key}.subject`, values),
        text: `${t(`${key}.intro`, values)}\n\n${t(`${key}.cta`)}`,
      });
    } catch {
      console.error(
        `[notify-request] EMAIL_DELIVERY_FAILED business ${business.id}`,
      );
    }
  }
}

async function notify(
  db: PrismaClient,
  input: { requestId: string; category: string; audience: AudienceMember[] },
): Promise<void> {
  await Promise.allSettled([
    sendEmails(db, { audience: input.audience, category: input.category }),
    sendPush(db, input.requestId, input.audience),
  ]);
}

/**
 * Tells business owners a customer opened a request to quotes. A business is
 * notified when the request falls inside its branch coverage radius, when its
 * catalog (services or published products) covers the request category, or
 * both — each with its own email copy (see `findRequestAudience`). Targeted
 * requests (D10-11) reach only their business. Never throws: `request.create`
 * calls it fire-and-forget and only logs the failure.
 */
export async function notifyNearbyBusinesses(
  db: PrismaClient,
  requestId: string,
): Promise<ServiceResult<NotifyNearbyResult, "INTERNAL_ERROR">> {
  try {
    const request = await db.serviceRequest.findUnique({
      where: { id: requestId },
      select: {
        customerId: true,
        category: true,
        latitude: true,
        longitude: true,
        targetBusinessId: true,
      },
    });

    if (!request) {
      return svcFail("NOT_FOUND", "Request not found");
    }

    // D10-11: a targeted request reaches only its business (if ACTIVE),
    // without the category and radius match.
    if (request.targetBusinessId !== null) {
      const target = await db.business.findFirst({
        where: { id: request.targetBusinessId, status: "ACTIVE" },
        select: { id: true },
      });
      const audience: AudienceMember[] = target
        ? [{ businessId: target.id, reason: "MATCH" }]
        : [];

      await notify(db, { requestId, category: request.category, audience });

      return svcOk({ audience });
    }

    if (request.latitude === null || request.longitude === null) {
      // Nothing to match against without a location; not an error.
      return svcOk({ audience: [] });
    }

    const audience = await findRequestAudience(db, {
      customerId: request.customerId,
      category: request.category,
      point: { latitude: request.latitude, longitude: request.longitude },
    });

    await notify(db, { requestId, category: request.category, audience });

    return svcOk({ audience });
  } catch {
    return svcFail("INTERNAL_ERROR", "Nearby business notification failed");
  }
}
