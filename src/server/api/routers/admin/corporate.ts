import {
  activateCorporateAccountSchema,
  createCorporateAccountSchema,
  getCorporateAccountSchema,
  listCorporateAccountsSchema,
  reactivateCorporateAccountSchema,
  rejectTierChangeSchema,
  suspendCorporateAccountSchema,
  updateCorporateTermsSchema,
} from "~/app/[locale]/admin/corporate/_components/corporate.schema";
import { env } from "~/env";
import { fail, normalizeError, ok } from "~/server/api/contract";
import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  activateCorporateAccount,
  createCorporateAccount,
  getCorporateAccountDetail,
  listCorporateAccounts,
  reactivateCorporateAccount,
  reconcileCorporateBilling,
  rejectCorporateTierChange,
  suspendCorporateAccount,
  updateCorporateTerms,
} from "~/server/services/corporate/corporate-accounts";
import { createResendEmailClientFromApiKey } from "~/server/services/email/email-client";
import { getStripe } from "~/server/services/stripe/client";

// The adapter is built once and injected; services never import `resend`.
const corporateInvitationEmailClient =
  env.RESEND_API_KEY && env.EMAIL_FROM
    ? createResendEmailClientFromApiKey(env.RESEND_API_KEY, env.EMAIL_FROM)
    : null;

/** Every stable code of this namespace mapped to its HTTP-ish status. */
const STATUS_BY_CODE: Record<string, number> = {
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  EMAIL_TAKEN: 409,
  PLAN_NOT_SYNCED: 409,
  EMAIL_DELIVERY_FAILED: 502,
  STRIPE_ERROR: 502,
};

function statusFor(code: string): number {
  return STATUS_BY_CODE[code] ?? 500;
}

function corporateFailure(error: unknown, message: string) {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/**
 * `admin.corporate` (F7-03): administration of the B2B corporate accounts and
 * their Billing lifecycle. Everything runs under `adminProcedure`; a wrong
 * role receives the same uniform 403 as everywhere else.
 */
export const adminCorporateRouter = createTRPCRouter({
  list: adminProcedure
    .input(listCorporateAccountsSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await listCorporateAccounts({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, statusFor(result.code), "Corporate directory unavailable");
        }

        return ok(result.data, "Corporate accounts loaded");
      } catch (error) {
        return corporateFailure(error, "Corporate directory query failed");
      }
    }),

  getById: adminProcedure
    .input(getCorporateAccountSchema)
    .query(async ({ ctx, input }) => {
      try {
        const result = await getCorporateAccountDetail({ db: ctx.db }, input);

        if (!result.ok) {
          return fail(result.code, statusFor(result.code), "Corporate account not found");
        }

        return ok(result.data, "Corporate account loaded");
      } catch (error) {
        return corporateFailure(error, "Corporate account query failed");
      }
    }),

  /**
   * Tier catalog for the create/terms forms. The Stripe price id is never
   * exposed, only whether the tier can already be billed.
   */
  listTiers: adminProcedure.query(async ({ ctx }) => {
    try {
      const tiers = await ctx.db.corporateTierConfig.findMany({
        where: { isActive: true },
        orderBy: { monthlyFeeCents: { sort: "asc", nulls: "last" } },
        select: {
          tier: true,
          monthlyFeeCents: true,
          maxLocations: true,
          commissionPct: true,
          stripePriceId: true,
        },
      });

      return ok(
        tiers.map(({ stripePriceId, ...tier }) => ({
          ...tier,
          isSynced: stripePriceId !== null,
        })),
        "Corporate tiers loaded",
      );
    } catch (error) {
      return corporateFailure(error, "Corporate tiers query failed");
    }
  }),

  /**
   * ADMIN users eligible as account managers (tier >= STANDARD requires one).
   */
  listAccountManagers: adminProcedure.query(async ({ ctx }) => {
    try {
      const managers = await ctx.db.user.findMany({
        where: { role: "ADMIN" },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, name: true, email: true },
      });

      return ok(managers, "Account managers loaded");
    } catch (error) {
      return corporateFailure(error, "Account managers query failed");
    }
  }),

  create: adminProcedure
    .input(createCorporateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createCorporateAccount(
          {
            db: ctx.db,
            emailClient: corporateInvitationEmailClient,
            appUrl: env.APP_URL,
          },
          input,
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Corporate account could not be created",
          );
        }

        return ok(result.data, "Corporate account created", 201);
      } catch (error) {
        return corporateFailure(error, "Corporate account creation failed");
      }
    }),

  activate: adminProcedure
    .input(activateCorporateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await activateCorporateAccount(
          { db: ctx.db, stripe: getStripe() },
          input,
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Corporate account could not be activated",
          );
        }

        return ok(result.data, "Corporate account activated");
      } catch (error) {
        return corporateFailure(error, "Corporate account activation failed");
      }
    }),

  /**
   * Repairs an activation interrupted between Stripe and the local database
   * (F7-07). Idempotent: a second run never creates another Customer,
   * Subscription, Price or Invoice.
   */
  reconcileBilling: adminProcedure
    .input(getCorporateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await reconcileCorporateBilling(
          { db: ctx.db, stripe: getStripe() },
          input,
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Corporate billing could not be reconciled",
          );
        }

        return ok(result.data, "Corporate billing reconciled");
      } catch (error) {
        return corporateFailure(error, "Corporate billing reconciliation failed");
      }
    }),

  updateTerms: adminProcedure
    .input(updateCorporateTermsSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await updateCorporateTerms(
          { db: ctx.db, stripe: getStripe() },
          { ...input, adminId: ctx.session.user.id },
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Corporate terms could not be updated",
          );
        }

        return ok(result.data, "Corporate terms updated");
      } catch (error) {
        return corporateFailure(error, "Corporate terms update failed");
      }
    }),

  suspend: adminProcedure
    .input(suspendCorporateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await suspendCorporateAccount(
          { db: ctx.db, stripe: getStripe() },
          input,
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Corporate account could not be suspended",
          );
        }

        return ok(result.data, "Corporate account suspended");
      } catch (error) {
        return corporateFailure(error, "Corporate account suspension failed");
      }
    }),

  reactivate: adminProcedure
    .input(reactivateCorporateAccountSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await reactivateCorporateAccount(
          { db: ctx.db, stripe: getStripe() },
          input,
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Corporate account could not be reactivated",
          );
        }

        return ok(result.data, "Corporate account reactivated");
      } catch (error) {
        return corporateFailure(error, "Corporate account reactivation failed");
      }
    }),

  rejectTierChange: adminProcedure
    .input(rejectTierChangeSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await rejectCorporateTierChange(
          { db: ctx.db },
          {
            accountId: input.accountId,
            requestId: input.requestId,
            adminId: ctx.session.user.id,
          },
        );

        if (!result.ok) {
          return fail(
            result.code,
            statusFor(result.code),
            "Tier change request could not be rejected",
          );
        }

        return ok(result.data, "Tier change request rejected");
      } catch (error) {
        return corporateFailure(error, "Tier change rejection failed");
      }
    }),
});
