import {
  saveAdminSettingsSchema,
  updatePlanCommissionsSchema,
  updatePlatformSettingsSchema,
} from "~/app/[locale]/admin/settings/_components/settings.schema";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  getPlatformSettings,
  saveAdminSettings,
  updatePlanCommissions,
  updatePlatformSettings,
  type SettingsErrorCode,
} from "~/server/services/admin/platform-settings";

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

  updatePlanCommissions: adminProcedure
    .input(updatePlanCommissionsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await updatePlanCommissions({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Commissions could not be updated",
          );
        }

        return ok(result.data, "Plan commissions updated");
      } catch (error) {
        return normalizedFailure(error, "Plan commissions update failed");
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
});
