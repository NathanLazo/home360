import { env } from "~/env";
import { splitLocaleFromPathname, type Locale } from "~/i18n/locale-pathname";
import { routing } from "~/i18n/routing";
import { PLAN_CODES } from "~/lib/subscription/plan-codes";
import {
  listInvoicesSchema,
  planChangeSchema,
  type SubscriptionErrorCode,
} from "~/lib/subscription/subscription.schemas";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
} from "~/server/api/trpc";
import { getStripe } from "~/server/services/stripe/client";
import { createBillingPortalSession } from "~/server/services/subscription/billing";
import {
  changePlan,
  previewPlanChange,
} from "~/server/services/subscription/change-plan";
import {
  buildPlanUsageReport,
  getPlanUsage,
} from "~/server/services/subscription/plan-limits";

const INVOICE_PAGE_SIZE = 10;

/**
 * HTTP status for every service code this router can receive. Missing rows are
 * 404, state conflicts 409 and Stripe outages 502.
 */
const serviceErrorStatuses = {
  CONFLICT: 409,
  NO_SUBSCRIPTION: 409,
  NOT_FOUND: 404,
  PLAN_LIMIT_REACHED: 409,
  PLAN_NOT_FOUND: 404,
  PLAN_NOT_SYNCED: 409,
  SAME_PLAN: 409,
  STRIPE_ERROR: 502,
  SUBSCRIPTION_NOT_ACTIVE: 409,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, SubscriptionErrorCode> {
  return fail<never, SubscriptionErrorCode>(
    code,
    serviceErrorStatuses[code],
    message,
  );
}

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never, SubscriptionErrorCode> {
  const normalized = normalizeError(error);

  return fail<never, SubscriptionErrorCode>(
    normalized.code,
    normalized.status,
    message,
  );
}

/**
 * Resolves the caller locale from the request origin instead of client input,
 * so the Billing Portal returns to the same localized dashboard.
 */
function localeFromHeaders(headers: Headers): Locale {
  const referer = headers.get("referer");

  if (!referer) {
    return routing.defaultLocale;
  }

  try {
    const { locale } = splitLocaleFromPathname(new URL(referer).pathname);

    return locale ?? routing.defaultLocale;
  } catch {
    return routing.defaultLocale;
  }
}

const planSelect = {
  code: true,
  name: true,
  priceCents: true,
  commissionPct: true,
  maxBranches: true,
  maxWorkers: true,
  maxProducts: true,
} as const;

export const subscriptionRouter = createTRPCRouter({
  /**
   * Readable by any business, including one that is pending or suspended: the
   * UI needs the reason behind a degraded dashboard, and `businessProcedure`
   * is the only guard a canceled subscription still passes.
   */
  getCurrent: businessProcedure.query(async ({ ctx }) => {
    try {
      const subscription = await ctx.db.subscription.findUnique({
        where: { businessId: ctx.business.id },
        select: {
          status: true,
          renewsAt: true,
          plan: { select: planSelect },
        },
      });

      // Not an error: a business approved before F4, or still pending, simply
      // has no plan yet.
      if (!subscription) {
        return ok(null, "Business has no subscription");
      }

      const usage = await getPlanUsage(ctx.db, ctx.business.id);

      return ok(
        {
          status: subscription.status,
          renewsAt: subscription.renewsAt,
          plan: subscription.plan,
          usage: buildPlanUsageReport(usage, subscription.plan),
        },
        "Subscription loaded",
      );
    } catch (error) {
      return unexpectedFailure(error, "Subscription lookup failed");
    }
  }),

  listPlans: businessProcedure.query(async ({ ctx }) => {
    try {
      const [plans, subscription] = await Promise.all([
        ctx.db.plan.findMany({
          where: { code: { in: [...PLAN_CODES] } },
          select: { ...planSelect, stripePriceId: true },
        }),
        ctx.db.subscription.findUnique({
          where: { businessId: ctx.business.id },
          select: { plan: { select: { code: true } } },
        }),
      ]);

      // Ordered by the commercial ladder, not by price, and validated to hold
      // exactly one row per code: a broken catalogue is a conflict, not a
      // half-rendered grid.
      const items = PLAN_CODES.map((code) => {
        const matches = plans.filter((plan) => plan.code === code);
        const plan = matches[0];

        if (matches.length !== 1 || !plan) {
          return null;
        }

        const { stripePriceId, ...rest } = plan;

        return {
          ...rest,
          code,
          isCurrent: subscription?.plan.code === code,
          isAvailable: stripePriceId !== null,
        };
      });

      if (items.some((item) => item === null)) {
        return serviceFailure("CONFLICT", "Plan catalogue is misconfigured");
      }

      return ok(items.filter((item) => item !== null), "Plans loaded");
    } catch (error) {
      return unexpectedFailure(error, "Plan listing failed");
    }
  }),

  /**
   * Query, not mutation: it only asks Stripe what the change would cost. It
   * answers with `fits: false` and `exceeds` as a success so the dialog can
   * explain exactly what blocks the downgrade.
   */
  previewChange: activeBusinessProcedure
    .input(planChangeSchema)
    .query(async ({ ctx, input }) => {
      try {
        const preview = await previewPlanChange(
          { db: ctx.db, stripe: getStripe() },
          { businessId: ctx.business.id, planCode: input.planCode },
        );

        if (!preview.ok) {
          return serviceFailure(preview.code, "Plan change preview failed");
        }

        return ok(preview.data, "Plan change preview ready");
      } catch (error) {
        return unexpectedFailure(error, "Plan change preview failed");
      }
    }),

  changePlan: activeBusinessProcedure
    .input(planChangeSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const changed = await changePlan(
          { db: ctx.db, stripe: getStripe() },
          { businessId: ctx.business.id, planCode: input.planCode },
        );

        if (!changed.ok) {
          return serviceFailure(changed.code, "Plan change failed");
        }

        return ok(changed.data, "Plan changed");
      } catch (error) {
        return unexpectedFailure(error, "Plan change failed");
      }
    }),

  listInvoices: businessProcedure
    .input(listInvoicesSchema)
    .query(async ({ ctx, input }) => {
      try {
        const invoices = await ctx.db.invoice.findMany({
          // Multitenancy lives in the `where`, never in the input.
          where: { subscription: { businessId: ctx.business.id } },
          take: INVOICE_PAGE_SIZE + 1,
          ...(input.cursor
            ? { cursor: { id: input.cursor }, skip: 1 }
            : {}),
          orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            amountCents: true,
            status: true,
            issuedAt: true,
            pdfUrl: true,
          },
        });
        const hasNextPage = invoices.length > INVOICE_PAGE_SIZE;
        const items = invoices.slice(0, INVOICE_PAGE_SIZE);

        return ok(
          {
            items,
            nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
          },
          "Invoices loaded",
        );
      } catch (error) {
        return unexpectedFailure(error, "Invoice listing failed");
      }
    }),

  /**
   * Opens the Stripe Billing Customer Portal (`PENDIENTES.md` §8), the only
   * place where the business adds a card, cancels or resumes.
   *
   * Deliberately a `businessProcedure`: a business whose subscription is
   * `CANCELED` must still reach the Portal to fix it, and
   * `activeBusinessProcedure` rejects exactly that case by design (F4-07).
   */
  createPortalSession: businessProcedure.mutation(async ({ ctx }) => {
    try {
      const locale = localeFromHeaders(ctx.headers);
      const session = await createBillingPortalSession(
        { db: ctx.db, stripe: getStripe() },
        {
          businessId: ctx.business.id,
          returnUrl: `${env.APP_URL}/${locale}/dashboard/subscription`,
        },
      );

      if (!session.ok) {
        return serviceFailure(session.code, "Billing portal session failed");
      }

      return ok(session.data, "Billing portal session created");
    } catch (error) {
      return unexpectedFailure(error, "Billing portal session failed");
    }
  }),
});
