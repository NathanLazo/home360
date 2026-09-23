import { getTranslations } from "next-intl/server";

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
  corporateOpenDisputeSchema,
  corporateOrderIdSchema,
  corporateQuoteIdSchema,
  corporateRequestCreateSchema,
  corporateRequestIdSchema,
  corporateRequestListSchema,
  corporateReworkSchema,
} from "~/server/api/schemas/corporate";
import {
  activeCorporateProcedure,
  corporateProcedure,
} from "~/server/api/trpc";
import { listCorporateRequests } from "~/server/services/corporate/corporate-requests";
import { requestDisputeSummary } from "~/server/services/disputes/dispute-summary-hook";
import { openCustomerDispute } from "~/server/services/disputes/open-dispute";
import { createServiceRequest } from "~/server/services/marketplace/request";
import { cancelUnpaidOrder } from "~/server/services/orders/cancel-unpaid-order";
import { confirmOrderDelivery } from "~/server/services/orders/confirm-delivery";
import { getConsumerOrderDetail } from "~/server/services/orders/consumer-order-detail";
import {
  acceptQuote,
  listQuotesByRequest,
} from "~/server/services/orders/quotes";
import { requestOrderRework } from "~/server/services/orders/request-rework";
import { createOrderCheckoutSession } from "~/server/services/payments/order-checkout-session";
import type { ServiceResult } from "~/server/services/service-result";
import { getStripe } from "~/server/services/stripe/client";

/**
 * HTTP status per service code surfaced by the shared consumer services.
 * Anything not listed is a 409 (a state conflict of the marketplace flow).
 */
const SERVICE_STATUSES: Record<string, number> = {
  NOT_FOUND: 404,
  ORDER_NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  AI_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
  STRIPE_ERROR: 502,
  LOCATION_COORDINATES_REQUIRED: 422,
};

function fromService<TData, TCode extends string>(
  result: ServiceResult<TData, TCode>,
  message: string,
  successStatus = 200,
): TrpcResponse<TData, TCode> {
  if (result.ok) {
    return {
      result: result.data,
      error: null,
      status: successStatus,
      message,
    };
  }

  return fail<TData, TCode>(
    result.code,
    SERVICE_STATUSES[result.code] ?? 409,
    message,
  );
}

function consumerFailure(error: unknown): TrpcResponse<never> {
  const normalized = normalizeError(error);

  return fail(normalized.code, normalized.status, "Corporate operation failed");
}

/** Locale of the portal page that triggered the call (never client input). */
function localeFromHeaders(headers: Headers): Locale {
  const referer = headers.get("referer");

  if (!referer) {
    return routing.defaultLocale;
  }

  try {
    return (
      splitLocaleFromPathname(new URL(referer).pathname).locale ??
      routing.defaultLocale
    );
  } catch {
    return routing.defaultLocale;
  }
}

function localizedUrl(locale: Locale, pathname: string): string {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;

  return new URL(`${prefix}${pathname}`, env.APP_URL).toString();
}

/**
 * Corporate consumer flow (F7, workstream D). An ACTIVE account acts as a
 * marketplace buyer: it raises requests from its locations, compares and
 * accepts offers and pays through a hosted Stripe Checkout Session; the
 * resulting orders carry `corporateAccountId`/`corporateLocationId`, so the
 * preferential commission is frozen at capture. The corporate owner user is
 * the order's `customerId`; every query is additionally scoped by the
 * account id resolved from the session. Order follow-up (detail, confirm,
 * dispute, cancel) stays available to non-active accounts: they must still
 * be able to close work they already paid for.
 */
export const corporateConsumerProcedures = {
  listRequests: corporateProcedure
    .input(corporateRequestListSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await listCorporateRequests(
          ctx.db,
          ctx.corporateAccount.id,
          input,
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  createRequest: activeCorporateProcedure
    .input(corporateRequestCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await createServiceRequest(ctx.db, {
          customerId: ctx.session.user.id,
          mediaPathnames: input.mediaPathnames,
          description: input.description,
          location: {
            kind: "CORPORATE_LOCATION",
            corporateAccountId: ctx.corporateAccount.id,
            corporateLocationId: input.corporateLocationId,
          },
          diagnosis: { kind: "MANUAL", category: input.category },
        });

        if (!created.ok) {
          return fromService(created, "Corporate request failed");
        }

        return ok(
          { id: created.data.request.id },
          "Corporate request created",
          201,
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  listRequestQuotes: corporateProcedure
    .input(corporateRequestIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const owned = await ctx.db.serviceRequest.findFirst({
          where: {
            id: input.requestId,
            corporateAccountId: ctx.corporateAccount.id,
          },
          select: { id: true },
        });

        if (!owned) {
          return fail("NOT_FOUND", 404, "Request not found");
        }

        return fromService(
          await listQuotesByRequest(ctx.db, {
            customerId: ctx.session.user.id,
            requestId: owned.id,
            sort: "recommended",
          }),
          "Quotes loaded",
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  acceptQuote: activeCorporateProcedure
    .input(corporateQuoteIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const owned = await ctx.db.quote.findFirst({
          where: {
            id: input.quoteId,
            request: { corporateAccountId: ctx.corporateAccount.id },
          },
          select: { id: true },
        });

        if (!owned) {
          return fail("NOT_FOUND", 404, "Quote not found");
        }

        return fromService(
          await acceptQuote(ctx.db, {
            customerId: ctx.session.user.id,
            quoteId: owned.id,
          }),
          "Quote accepted",
          201,
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  createCheckoutSession: activeCorporateProcedure
    .input(corporateOrderIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const owned = await ctx.db.order.findFirst({
          where: {
            id: input.orderId,
            corporateAccountId: ctx.corporateAccount.id,
          },
          select: { id: true },
        });

        if (!owned) {
          return fail("NOT_FOUND", 404, "Order not found");
        }

        const locale = localeFromHeaders(ctx.headers);
        const t = await getTranslations({
          locale,
          namespace: "corporate.checkout",
        });

        return fromService(
          await createOrderCheckoutSession(
            { db: ctx.db, stripe: getStripe() },
            {
              customerId: ctx.session.user.id,
              orderId: owned.id,
              successUrl: localizedUrl(locale, "/pay/success"),
              cancelUrl: localizedUrl(locale, "/pay/cancelled"),
              serviceFeeLabel: t("serviceFeeLabel"),
            },
          ),
          "Checkout session created",
          201,
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  getOrder: corporateProcedure
    .input(corporateOrderIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        return fromService(
          await getConsumerOrderDetail(
            ctx.db,
            { kind: "CORPORATE", corporateAccountId: ctx.corporateAccount.id },
            input.orderId,
          ),
          "Corporate order loaded",
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  confirmDelivery: corporateProcedure
    .input(corporateOrderIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return fromService(
          await confirmOrderDelivery(
            { db: ctx.db, stripe: getStripe() },
            {
              scope: {
                kind: "CORPORATE",
                corporateAccountId: ctx.corporateAccount.id,
              },
              orderId: input.orderId,
            },
          ),
          "Delivery confirmed",
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  requestRework: corporateProcedure
    .input(corporateReworkSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return fromService(
          await requestOrderRework(ctx.db, {
            customerId: ctx.session.user.id,
            orderId: input.orderId,
            note: input.note,
          }),
          "Rework requested",
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  openDispute: corporateProcedure
    .input(corporateOpenDisputeSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const opened = await openCustomerDispute(ctx.db, {
          customerId: ctx.session.user.id,
          orderId: input.orderId,
          reason: input.reason,
          description: input.description,
          evidencePathnames: [],
        });

        if (opened.ok) {
          requestDisputeSummary(ctx.db, opened.data.disputeId);
        }

        return fromService(opened, "Dispute opened", 201);
      } catch (error) {
        return consumerFailure(error);
      }
    }),

  cancelOrder: corporateProcedure
    .input(corporateOrderIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return fromService(
          await cancelUnpaidOrder(
            { db: ctx.db, stripe: getStripe() },
            { customerId: ctx.session.user.id, orderId: input.orderId },
          ),
          "Order cancelled",
        );
      } catch (error) {
        return consumerFailure(error);
      }
    }),
};
