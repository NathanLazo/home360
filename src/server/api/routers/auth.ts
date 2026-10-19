import { env } from "~/env";
import {
  requestPasswordResetSchema,
  resetPasswordTransportSchema,
} from "~/schemas/auth/password-reset.schema";
import { registerBusinessSchema } from "~/schemas/auth/register-business.schema";
import {
  acceptWorkerInvitationSchema,
  workerInvitationLookupSchema,
} from "~/schemas/auth/worker-invitation.schema";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { customerRegisterSchema } from "~/server/api/schemas/customer-register.schema";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { deleteMyAccount } from "~/server/services/account/delete-account";
import { getCurrentUser } from "~/server/services/auth/current-user";
import {
  requestPasswordReset,
  resetPassword,
} from "~/server/services/auth/password-reset";
import { registerBusiness } from "~/server/services/auth/register-business";
import { registerCustomer } from "~/server/services/auth/register-customer";
import {
  acceptWorkerInvitation,
  getWorkerInvitationPreview,
} from "~/server/services/team/accept-worker-invitation";
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

/** Roles that sign up or are invited through the mobile app. */
const SELF_DELETABLE_ROLES = new Set(["CUSTOMER", "BUSINESS", "WORKER"]);

export const authRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) =>
    getCurrentUser(ctx.db, ctx.session.user.id),
  ),
  /**
   * App Store 5.1.1(v): in-app account deletion. Anonymizes and suspends the
   * user (traceability is kept); refused while orders or a business
   * subscription are still active. Admin/corporate accounts are managed on
   * the web.
   */
  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    if (!SELF_DELETABLE_ROLES.has(ctx.session.user.role)) {
      return fail("FORBIDDEN", 403, "Account deletion not available");
    }

    try {
      const deleted = await deleteMyAccount(ctx.db, ctx.session.user.id);

      if (!deleted.ok) {
        const status = deleted.code === "NOT_FOUND" ? 404 : 409;
        return fail(deleted.code, status, "Account deletion refused");
      }

      return ok(deleted.data, "Account deleted");
    } catch (error) {
      const normalized = normalizeError(error);
      return fail(
        normalized.code,
        normalized.status,
        "Account deletion failed",
      );
    }
  }),
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
  registerCustomer: publicProcedure
    .input(customerRegisterSchema)
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

      return registerCustomer(ctx.db, input);
    }),
  /** Public preview of a worker invitation link (web page and mobile). */
  getWorkerInvitation: publicProcedure
    .input(workerInvitationLookupSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getWorkerInvitationPreview(ctx.db, input.token);
      } catch (error) {
        const { code, status } = normalizeError(error);
        return fail(code, status, "Invitation lookup failed");
      }
    }),
  /**
   * Accepts a worker invitation creating the WORKER account (web page
   * `/invite/worker` and mobile). Rate limited per IP like registration.
   */
  acceptWorkerInvitation: publicProcedure
    .input(acceptWorkerInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      const reservation = await reserveRateLimitAttempts(ctx.db, [
        {
          action: "register",
          identifier: ipRateLimitIdentifier(clientIpFromHeaders(ctx.headers)),
          max: 10,
          windowMinutes: 60,
        },
      ]);

      if (!reservation.allowed) {
        return fail("TOO_MANY_REQUESTS", 429, "Too many attempts");
      }

      try {
        return await acceptWorkerInvitation(ctx.db, input);
      } catch (error) {
        const { code, status } = normalizeError(error);
        return fail(code, status, "Invitation acceptance failed");
      }
    }),
});
