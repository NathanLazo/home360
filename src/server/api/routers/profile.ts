import { TRPCError } from "@trpc/server";

import { agentAreaForRole } from "~/lib/agent/agent-area";
import {
  removeDeviceSchema,
  setPasswordSchema,
  updateAssistantPreferencesSchema,
  updateIdentitySchema,
} from "~/schemas/profile/profile.schema";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  getProfileSummary,
  type ProfileSummary,
} from "~/server/services/profile/profile-summary";
import {
  removeDevice,
  setPassword,
  signOutEverywhere,
  updateAssistantPreferences,
  updateIdentity,
} from "~/server/services/profile/update-profile";

/**
 * The profile belongs to the session user of a panel role (business,
 * corporate, admin). Customers and workers live in the mobile app and have no
 * web profile. Mutations under impersonation are refused by
 * `protectedProcedure` (IMPERSONATION_READ_ONLY).
 */
const profileProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!agentAreaForRole(ctx.session.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }

  return next({ ctx: { ...ctx, userId: ctx.session.user.id } });
});

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

export const profileRouter = createTRPCRouter({
  get: profileProcedure.query(
    async ({ ctx }): Promise<TrpcResponse<ProfileSummary>> => {
      try {
        const profile = await getProfileSummary(ctx.db, ctx.userId);

        if (!profile) {
          return fail("NOT_FOUND", 404, "User not found");
        }

        return ok(profile, "Profile retrieved");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to load the profile");
      }
    },
  ),

  updateIdentity: profileProcedure
    .input(updateIdentitySchema)
    .mutation(async ({ ctx, input }): Promise<TrpcResponse<null>> => {
      try {
        await updateIdentity(ctx.db, ctx.userId, input);
        return ok(null, "Identity updated");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to update the identity");
      }
    }),

  updateAssistantPreferences: profileProcedure
    .input(updateAssistantPreferencesSchema)
    .mutation(async ({ ctx, input }): Promise<TrpcResponse<null>> => {
      try {
        await updateAssistantPreferences(ctx.db, ctx.userId, input);
        return ok(null, "Assistant preferences updated");
      } catch (error: unknown) {
        return unexpectedFailure(
          error,
          "Unable to update the assistant preferences",
        );
      }
    }),

  setPassword: profileProcedure.input(setPasswordSchema).mutation(
    async ({
      ctx,
      input,
    }): Promise<
      TrpcResponse<null, "CURRENT_PASSWORD_INVALID" | "PASSWORD_ALREADY_SET">
    > => {
      try {
        const result = await setPassword(ctx.db, ctx.userId, input);

        if (!result.ok) {
          return fail<
            never,
            "CURRENT_PASSWORD_INVALID" | "PASSWORD_ALREADY_SET"
          >(
            result.code,
            result.code === "PASSWORD_ALREADY_SET" ? 409 : 400,
            "Password check failed",
          );
        }

        return {
          result: null,
          error: null,
          status: 200,
          message: "Password updated",
        };
      } catch (error: unknown) {
        const normalized = normalizeError(error);
        return fail<
          never,
          "CURRENT_PASSWORD_INVALID" | "PASSWORD_ALREADY_SET"
        >(normalized.code, normalized.status, "Unable to update the password");
      }
    },
  ),

  signOutEverywhere: profileProcedure.mutation(
    async ({ ctx }): Promise<TrpcResponse<null>> => {
      try {
        await signOutEverywhere(ctx.db, ctx.userId);
        return ok(null, "All sessions revoked");
      } catch (error: unknown) {
        return unexpectedFailure(error, "Unable to revoke the sessions");
      }
    },
  ),

  removeDevice: profileProcedure.input(removeDeviceSchema).mutation(
    async ({
      ctx,
      input,
    }): Promise<TrpcResponse<null, "DEVICE_NOT_FOUND">> => {
      try {
        const result = await removeDevice(ctx.db, ctx.userId, input.deviceId);

        if (!result.ok) {
          return fail<never, "DEVICE_NOT_FOUND">(
            "DEVICE_NOT_FOUND",
            404,
            "Device not found",
          );
        }

        return {
          result: null,
          error: null,
          status: 200,
          message: "Device removed",
        };
      } catch (error: unknown) {
        const normalized = normalizeError(error);
        return fail<never, "DEVICE_NOT_FOUND">(
          normalized.code,
          normalized.status,
          "Unable to remove the device",
        );
      }
    },
  ),
});
