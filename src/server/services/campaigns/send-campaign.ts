import "server-only";

import {
  AdminAuditAction,
  CampaignAudience,
  UserRole,
  type PrismaClient,
} from "@generated/prisma";

import { CAMPAIGNS_PAGE_SIZE } from "~/app/[locale]/admin/settings/_components/campaigns.schema";
import { writeAdminAudit } from "../admin/admin-audit";
import { sendPushToTokens } from "../push/expo-push";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Page size of the token scan: keeps each query and each send bounded. */
const TOKEN_BATCH_SIZE = 1_000;

const AUDIENCE_ROLES: Record<CampaignAudience, UserRole[]> = {
  [CampaignAudience.ALL]: [
    UserRole.CUSTOMER,
    UserRole.BUSINESS,
    UserRole.WORKER,
  ],
  [CampaignAudience.CUSTOMERS]: [UserRole.CUSTOMER],
  [CampaignAudience.BUSINESSES]: [UserRole.BUSINESS],
  [CampaignAudience.WORKERS]: [UserRole.WORKER],
};

export type SendCampaignResult = {
  id: string;
  recipientCount: number;
  devicesReached: number;
};

/**
 * W13 "Campañas y anuncios": manual broadcast from the admin panel. The copy
 * is admin-authored and sent verbatim (not localized). Recipients are every
 * non-suspended user of the audience's roles with at least one registered
 * Expo device; `recipientCount` counts users, not devices.
 */
export async function sendCampaign(
  deps: { db: PrismaClient },
  input: {
    adminId: string;
    title: string;
    body: string;
    audience: CampaignAudience;
  },
): Promise<ServiceResult<SendCampaignResult, "VALIDATION_ERROR">> {
  const title = input.title.trim();
  const body = input.body.trim();

  if (title.length === 0 || body.length === 0) {
    return svcFail("VALIDATION_ERROR", "Campaign copy is empty");
  }

  const roles = AUDIENCE_ROLES[input.audience];
  const recipients = new Set<string>();
  let devicesReached = 0;
  let cursor: string | undefined;

  // Keyset scan over PushToken so memory stays flat whatever the audience.
  for (;;) {
    const batch = await deps.db.pushToken.findMany({
      where: { user: { role: { in: roles }, suspendedAt: null } },
      orderBy: { id: "asc" },
      take: TOKEN_BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, userId: true, expoToken: true },
    });

    if (batch.length === 0) {
      break;
    }

    for (const token of batch) {
      recipients.add(token.userId);
    }

    const delivery = await sendPushToTokens(
      deps.db,
      batch.map((token) => token.expoToken),
      { title, body, url: "home360app://home" },
    );
    devicesReached += delivery.sent;

    cursor = batch.at(-1)?.id;

    if (batch.length < TOKEN_BATCH_SIZE) {
      break;
    }
  }

  const campaign = await deps.db.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        title,
        body,
        audience: input.audience,
        sentById: input.adminId,
        recipientCount: recipients.size,
      },
      select: { id: true },
    });

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.CAMPAIGN_SENT,
      campaignId: created.id,
      metadata: {
        audience: input.audience,
        recipientCount: recipients.size,
      },
    });

    return created;
  });

  return svcOk({
    id: campaign.id,
    recipientCount: recipients.size,
    devicesReached,
  });
}

export async function listCampaigns(
  deps: { db: Pick<PrismaClient, "campaign"> },
  input: { cursor?: string },
) {
  const rows = await deps.db.campaign.findMany({
    take: CAMPAIGNS_PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      audience: true,
      sentAt: true,
      recipientCount: true,
      sentBy: { select: { name: true } },
    },
  });

  const hasNextPage = rows.length > CAMPAIGNS_PAGE_SIZE;
  const page = hasNextPage ? rows.slice(0, CAMPAIGNS_PAGE_SIZE) : rows;

  return svcOk({
    items: page.map(({ sentBy, ...campaign }) => ({
      ...campaign,
      sentByName: sentBy.name,
    })),
    nextCursor: hasNextPage ? (page.at(-1)?.id ?? null) : null,
  });
}
