import {
  changePasswordSchema,
  updateBusinessProfileSchema,
  updateOwnerSchema,
} from "~/schemas/settings/business-settings.schema";
import { fail, normalizeError } from "~/server/api/contract";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import {
  changePassword,
  getSettings,
  updateBusinessProfile,
  updateOwner,
} from "~/server/services/settings/business-settings";

function settingsFailure(error: unknown) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, "Settings operation failed");
}

export const businessSettingsRouter = createTRPCRouter({
  get: businessProcedure.query(async ({ ctx }) => {
    try {
      return await getSettings(ctx.db, ctx.business.id);
    } catch (error: unknown) {
      return settingsFailure(error);
    }
  }),

  // Commercial profile is public-facing data: it requires an ACTIVE business.
  updateBusinessProfile: activeBusinessProcedure
    .input(updateBusinessProfileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateBusinessProfile(ctx.db, ctx.business.id, input);
      } catch (error: unknown) {
        return settingsFailure(error);
      }
    }),

  // Account operations stay available to a suspended business.
  updateOwner: businessProcedure
    .input(updateOwnerSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateOwner(ctx.db, ctx.session.user.id, input);
      } catch (error: unknown) {
        return settingsFailure(error);
      }
    }),

  changePassword: businessProcedure
    .input(changePasswordSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await changePassword(ctx.db, ctx.session.user.id, input);
      } catch (error: unknown) {
        return settingsFailure(error);
      }
    }),
});
