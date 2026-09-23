import {
  listCampaignsSchema,
  sendCampaignSchema,
} from "~/app/[locale]/admin/settings/_components/campaigns.schema";
import {
  saveAdminSettingsSchema,
  updatePlatformSettingsSchema,
} from "~/app/[locale]/admin/settings/_components/settings.schema";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  getPlatformSettings,
  saveAdminSettings,
  updatePlatformSettings,
  type SettingsErrorCode,
} from "~/server/services/admin/platform-settings";
import {
  listCampaigns,
  sendCampaign,
} from "~/server/services/campaigns/send-campaign";

function normalizedFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

const statusFor = (code: SettingsErrorCode | "CONFLICT" | "STRIPE_ERROR") =>
  code === "NOT_FOUND" ? 404 : 409;

export const adminSettingsRouter = createTRPCRouter({
  get: adminProcedure.query(async ({ ctx }) => {
    try {
      const result = await getPlatformSettings({ db: ctx.db });

      if (!result.ok) {
        return fail(result.code, statusFor(result.code), "Settings not found");
      }

      return ok(result.data, "Platform settings loaded");
    } catch (error) {
      return normalizedFailure(error, "Platform settings query failed");
    }
  }),

  update: adminProcedure
    .input(updatePlatformSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await updatePlatformSettings({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Settings could not be updated",
          );
        }

        return ok(result.data, "Platform settings updated");
      } catch (error) {
        return normalizedFailure(error, "Platform settings update failed");
      }
    }),

  save: adminProcedure
    .input(saveAdminSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await saveAdminSettings(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Settings could not be saved",
          );
        }

        return ok(result.data, "Settings saved");
      } catch (error) {
        return normalizedFailure(error, "Settings save failed");
      }
    }),

  /** W13 "Campañas y anuncios": manual push broadcast to an audience. */
  sendCampaign: adminProcedure
    .input(sendCampaignSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await sendCampaign(
          { db: ctx.db },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            result.code === "VALIDATION_ERROR" ? 400 : 409,
            "Campaign could not be sent",
          );
        }

        return ok(result.data, "Campaign sent", 201);
      } catch (error) {
        return normalizedFailure(error, "Campaign send failed");
      }
    }),

  listCampaigns: adminProcedure
    .input(listCampaignsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listCampaigns({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, 409, "Campaigns unavailable");
        }

        return ok(result.data, "Campaigns loaded");
      } catch (error) {
        return normalizedFailure(error, "Campaigns query failed");
      }
    }),
});
