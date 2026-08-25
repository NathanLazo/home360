import {
  OrderEventType,
  OrderStatus,
  type Prisma,
} from "../../../../generated/prisma";
import { env } from "~/env";
import { splitLocaleFromPathname, type Locale } from "~/i18n/locale-pathname";
import { routing } from "~/i18n/routing";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import {
  confirmDeliverySchema,
  createPaymentLinkSchema,
  listTransactionsSchema,
  requestWithdrawalSchema,
  type PaymentErrorCode,
} from "~/server/api/routers/payment.schema";
import {
  activeBusinessProcedure,
  businessProcedure,
  createTRPCRouter,
  userProcedure,
} from "~/server/api/trpc";
import { getBusinessBalances } from "~/server/services/payments/balances";
import { releasePayment } from "~/server/services/payments/escrow";
import {
  createPaymentLink,
  reconcilePaymentLink,
} from "~/server/services/payments/payment-links";
import { requestWithdrawal } from "~/server/services/payments/withdrawals";
import { getStripe } from "~/server/services/stripe/client";
import { sendLocalizedPushToUser } from "~/server/services/push/messages";
import {
  createConnectAccount,
  createOnboardingLink,
  getAccountStatus,
} from "~/server/services/stripe/connect";

const PAGE_SIZE = 20;
const CONNECT_REFRESH_MAX_ATTEMPTS = 5;
const CONNECT_REFRESH_WINDOW_MS = 60_000;

/**
 * Order states a customer may confirm as delivered. `PENDING` is excluded
 * because the escrow does not exist yet, and terminal or disputed states are
 * never re-completed.
 */
const DELIVERABLE_ORDER_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
  OrderStatus.SHIPPING,
] as const;

/**
 * HTTP status for every service code the router can receive. Validation and
 * invalid targets are 400, missing rows 404, state/balance/dispute/pricing
 * conflicts 409 and Stripe outages 502. Anything unexpected is normalized to
 * 500 by `normalizeError`.
 */
const serviceErrorStatuses = {
  CONFLICT: 409,
  CORPORATE_PRICING_NOT_AVAILABLE: 409,
  DISPUTE_OPEN: 409,
  INSUFFICIENT_BALANCE: 409,
  INVALID_TARGET: 400,
  NO_CONNECT_ACCOUNT: 409,
  NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  PAYMENT_NOT_RELEASABLE: 409,
  REFUND_EXCEEDS_LIMIT: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, PaymentErrorCode> {
  return fail<never, PaymentErrorCode>(
    code,
    serviceErrorStatuses[code],
    message,
  );
}

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never, PaymentErrorCode> {
  const normalized = normalizeError(error);
  return fail<never, PaymentErrorCode>(
    normalized.code,
    normalized.status,
    message,
  );
}

/**
 * Resolves the caller locale from the request origin instead of client input,
 * so redirect URLs stay inside the same localized dashboard.
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

const connectRefreshAttempts = new Map<string, number[]>();

/**
 * In-process guard that keeps `refreshConnectStatus` from becoming an open
 * proxy to the Stripe accounts API.
 */
function allowConnectRefresh(key: string, now: number): boolean {
  const windowStart = now - CONNECT_REFRESH_WINDOW_MS;
  const recent = (connectRefreshAttempts.get(key) ?? []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (recent.length >= CONNECT_REFRESH_MAX_ATTEMPTS) {
    connectRefreshAttempts.set(key, recent);
    return false;
  }

  recent.push(now);
  connectRefreshAttempts.set(key, recent);
  return true;
}

const transactionSelect = {
  id: true,
  amountCents: true,
  method: true,
  status: true,
  createdAt: true,
  order: {
    select: { title: true, customer: { select: { name: true } } },
  },
  paymentLink: { select: { concept: true } },
} satisfies Prisma.PaymentSelect;

type TransactionPayload = Prisma.PaymentGetPayload<{
  select: typeof transactionSelect;
}>;

export type TransactionListItem = {
  id: string;
  customerName: string | null;
  concept: string;
  amountCents: number;
  method: TransactionPayload["method"];
  status: TransactionPayload["status"];
  createdAt: Date;
};

function toTransactionListItem(
  payment: TransactionPayload,
): TransactionListItem {
  return {
    id: payment.id,
    customerName: payment.order?.customer.name ?? null,
    concept: payment.order?.title ?? payment.paymentLink?.concept ?? "",
    amountCents: payment.amountCents,
    method: payment.method,
    status: payment.status,
    createdAt: payment.createdAt,
  };
}

export type ConnectStatus = {
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
};

function dashboardPaymentsUrl(locale: Locale, onboarding: string): string {
  return `${env.APP_URL}/${locale}/dashboard/payments?onboarding=${onboarding}`;
}

export const paymentRouter = createTRPCRouter({
  getBalances: businessProcedure.query(async ({ ctx }) => {
    try {
      const balances = await getBusinessBalances(
        { db: ctx.db },
        { businessId: ctx.business.id },
      );

      if (!balances.ok) {
        return serviceFailure(balances.code, "Balance lookup failed");
      }

      return ok(balances.data, "Balances loaded");
    } catch (error) {
      return unexpectedFailure(error, "Balance lookup failed");
    }
  }),

  listTransactions: businessProcedure
    .input(listTransactionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        if (input.cursor) {
          const cursor = await ctx.db.payment.findFirst({
            where: { id: input.cursor, businessId: ctx.business.id },
            select: { id: true },
          });

          if (!cursor) {
            return serviceFailure("NOT_FOUND", "Transaction cursor not found");
          }
        }

        const payments = await ctx.db.payment.findMany({
          where: {
            businessId: ctx.business.id,
            ...(input.status ? { status: input.status } : {}),
            ...(input.method ? { method: input.method } : {}),
          },
          take: PAGE_SIZE + 1,
          ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: transactionSelect,
        });
        const hasNextPage = payments.length > PAGE_SIZE;
        const items = payments.slice(0, PAGE_SIZE).map(toTransactionListItem);

        return ok(
          {
            items,
            nextCursor: hasNextPage ? (items.at(-1)?.id ?? null) : null,
          },
          "Transactions loaded",
        );
      } catch (error) {
        return unexpectedFailure(error, "Transaction listing failed");
      }
    }),

  getConnectStatus: businessProcedure.query(async ({ ctx }) => {
    try {
      const business = await ctx.db.business.findUnique({
        where: { id: ctx.business.id },
        select: {
          stripeAccountId: true,
          chargesEnabled: true,
          payoutsEnabled: true,
        },
      });

      if (!business) {
        return serviceFailure("NOT_FOUND", "Business not found");
      }

      const status: ConnectStatus = {
        hasAccount: business.stripeAccountId !== null,
        chargesEnabled: business.chargesEnabled,
        payoutsEnabled: business.payoutsEnabled,
      };

      return ok(status, "Connect status loaded");
    } catch (error) {
      return unexpectedFailure(error, "Connect status lookup failed");
    }
  }),

  refreshConnectStatus: businessProcedure.mutation(async ({ ctx }) => {
    try {
      if (!allowConnectRefresh(ctx.business.id, Date.now())) {
        return fail<never, "TOO_MANY_REQUESTS">(
          "TOO_MANY_REQUESTS",
          429,
          "Too many Connect status refreshes",
        );
      }

      const account = await getAccountStatus(
        { db: ctx.db, stripe: getStripe() },
        { businessId: ctx.business.id },
      );

      if (!account.ok) {
        return serviceFailure(account.code, "Connect status refresh failed");
      }

      const status: ConnectStatus = {
        hasAccount: true,
        chargesEnabled: account.data.chargesEnabled,
        payoutsEnabled: account.data.payoutsEnabled,
      };

      return ok(status, "Connect status refreshed");
    } catch (error) {
      return unexpectedFailure(error, "Connect status refresh failed");
    }
  }),

  startOnboarding: activeBusinessProcedure.mutation(async ({ ctx }) => {
    try {
      const stripe = getStripe();
      const deps = { db: ctx.db, stripe };
      const account = await createConnectAccount(deps, {
        businessId: ctx.business.id,
      });

      if (!account.ok) {
        return serviceFailure(account.code, "Connect account creation failed");
      }

      const locale = localeFromHeaders(ctx.headers);
      const link = await createOnboardingLink(deps, {
        businessId: ctx.business.id,
        returnUrl: dashboardPaymentsUrl(locale, "complete"),
        refreshUrl: dashboardPaymentsUrl(locale, "refresh"),
      });

      if (!link.ok) {
        return serviceFailure(link.code, "Onboarding link creation failed");
      }

      return ok({ url: link.data.url }, "Onboarding link created");
    } catch (error) {
      return unexpectedFailure(error, "Onboarding could not be started");
    }
  }),

  createPaymentLink: activeBusinessProcedure
    .input(createPaymentLinkSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const deps = { db: ctx.db, stripe: getStripe() };
        const created = await createPaymentLink(deps, {
          businessId: ctx.business.id,
          concept: input.concept,
          providerAmountCents: input.providerAmountCents,
          locale: localeFromHeaders(ctx.headers),
          baseUrl: env.APP_URL,
        });

        if (created.ok) {
          return ok(
            { id: created.data.paymentLinkId, url: created.data.url },
            "Payment link created",
          );
        }

        if (!created.recovery) {
          return serviceFailure(created.code, "Payment link creation failed");
        }

        // The row exists locally; publishing is idempotent on Stripe, so a
        // single reconciliation avoids leaking an orphan CREATING link.
        const reconciled = await reconcilePaymentLink(deps, {
          businessId: ctx.business.id,
          paymentLinkId: created.recovery.paymentLinkId,
        });

        if (!reconciled.ok) {
          return serviceFailure(
            reconciled.code,
            "Payment link creation failed",
          );
        }

        return ok(
          { id: reconciled.data.paymentLinkId, url: reconciled.data.url },
          "Payment link created",
        );
      } catch (error) {
        return unexpectedFailure(error, "Payment link creation failed");
      }
    }),

  requestWithdrawal: activeBusinessProcedure
    .input(requestWithdrawalSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const withdrawal = await requestWithdrawal(
          { db: ctx.db },
          {
            businessId: ctx.business.id,
            amountCents: input.amountCents,
            bankName: input.bankName,
            accountLast4: input.accountLast4,
          },
        );

        if (!withdrawal.ok) {
          return serviceFailure(withdrawal.code, "Withdrawal request failed");
        }

        return ok({ id: withdrawal.data.withdrawalId }, "Withdrawal requested");
      } catch (error) {
        return unexpectedFailure(error, "Withdrawal request failed");
      }
    }),

  confirmDelivery: userProcedure
    .input(confirmDeliverySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const order = await ctx.db.order.findFirst({
          where: { id: input.orderId, customerId: ctx.customer.id },
          select: {
            id: true,
            payment: { select: { id: true, status: true } },
            business: { select: { ownerId: true } },
          },
        });

        if (!order) {
          return serviceFailure("ORDER_NOT_FOUND", "Order not found");
        }

        if (!order.payment) {
          return serviceFailure(
            "PAYMENT_NOT_RELEASABLE",
            "Order has no escrowed payment",
          );
        }

        const completeOrder = async () => {
          await ctx.db.order.updateMany({
            where: {
              id: order.id,
              customerId: ctx.customer.id,
              status: { in: [...DELIVERABLE_ORDER_STATUSES] },
            },
            data: { status: OrderStatus.COMPLETED },
          });
        };

        const released = await releasePayment(
          { db: ctx.db, stripe: getStripe() },
          {
            paymentId: order.payment.id,
            event: {
              type: OrderEventType.CONFIRMED,
              actorUserId: ctx.customer.id,
            },
          },
        );

        if (!released.ok) {
          return serviceFailure(released.code, "Payment release failed");
        }

        await completeOrder();
        await sendLocalizedPushToUser(ctx.db, order.business.ownerId, {
          message: "deliveryConfirmed",
          url: `home360app://orders/${order.id}`,
        });

        return ok(
          { orderId: order.id, paymentId: released.data.paymentId },
          "Delivery confirmed",
        );
      } catch (error) {
        return unexpectedFailure(error, "Delivery confirmation failed");
      }
    }),
});
