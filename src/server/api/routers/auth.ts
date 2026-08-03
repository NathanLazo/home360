import { env } from "~/env";
import {
  requestPasswordResetSchema,
  resetPasswordTransportSchema,
} from "~/schemas/auth/password-reset.schema";
import { registerBusinessSchema } from "~/schemas/auth/register-business.schema";
import { fail, ok } from "~/server/api/contract";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  requestPasswordReset,
  resetPassword,
} from "~/server/services/auth/password-reset";
import { registerBusiness } from "~/server/services/auth/register-business";
import {
  clientIpFromHeaders,
  emailRateLimitIdentifier,
  ipRateLimitIdentifier,
  reserveRateLimitAttempts,
} from "~/server/services/auth/rate-limit";
import { createResendEmailClientFromApiKey } from "~/server/services/email/email-client";

const passwordResetEmailClient =
  env.RESEND_API_KEY && env.EMAIL_FROM
    ? createResendEmailClientFromApiKey(env.RESEND_API_KEY, env.EMAIL_FROM)
    : null;

export const authRouter = createTRPCRouter({
  requestPasswordReset: publicProcedure
    .input(requestPasswordResetSchema)
    .mutation(async ({ ctx, input }) => {
      const reservation = await reserveRateLimitAttempts(ctx.db, [
        {
          action: "password-reset",
          identifier: emailRateLimitIdentifier(input.email),
          max: 3,
          windowMinutes: 60,
        },
        {
          action: "password-reset",
          identifier: ipRateLimitIdentifier(clientIpFromHeaders(ctx.headers)),
          max: 10,
          windowMinutes: 60,
        },
      ]);

      if (!reservation.allowed) {
        return ok(
          null,
          "If the account is eligible, a reset email was sent",
          200,
        );
      }

      return requestPasswordReset(
        ctx.db,
        passwordResetEmailClient,
        env.APP_URL,
        input,
      );
    }),
  resetPassword: publicProcedure
    .input(resetPasswordTransportSchema)
    .mutation(({ ctx, input }) => resetPassword(ctx.db, input)),
  registerBusiness: publicProcedure
    .input(registerBusinessSchema)
    .mutation(async ({ ctx, input }) => {
      const reservation = await reserveRateLimitAttempts(ctx.db, [
        {
          action: "register",
          identifier: ipRateLimitIdentifier(clientIpFromHeaders(ctx.headers)),
          max: 5,
          windowMinutes: 60,
        },
      ]);

      if (!reservation.allowed) {
        return fail("TOO_MANY_REQUESTS", 429, "Too many registration attempts");
      }

      return registerBusiness(ctx.db, input);
    }),
});
