import { z } from "zod";

import { CampaignAudience } from "@generated/prisma";

/** Kept within what iOS/Android show without truncating a push banner. */
export const CAMPAIGN_TITLE_MAX_LENGTH = 65;
export const CAMPAIGN_BODY_MAX_LENGTH = 240;

export const CAMPAIGNS_PAGE_SIZE = 10;

export const campaignAudienceSchema = z.nativeEnum(CampaignAudience);

export const sendCampaignSchema = z
  .object({
    title: z.string().trim().min(3).max(CAMPAIGN_TITLE_MAX_LENGTH),
    body: z.string().trim().min(5).max(CAMPAIGN_BODY_MAX_LENGTH),
    audience: campaignAudienceSchema,
  })
  .strict();

export type SendCampaignInput = z.infer<typeof sendCampaignSchema>;

export const listCampaignsSchema = z
  .object({ cursor: z.string().cuid().optional() })
  .strict();
