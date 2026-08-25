import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import {
  acceptQuote,
  getMyQuote,
  listQuotesByRequest,
  QUOTE_SORTS,
} from "~/server/services/orders/quotes";

const listByRequestSchema = z.object({
  requestId: z.string().cuid(),
  sort: z.enum(QUOTE_SORTS).default("recommended"),
});

const quoteIdSchema = z.object({ id: z.string().cuid() });

/** HTTP status per service code surfaced by the quote services. */
const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  STRIPE_ERROR: 502,
} as const satisfies Record<string, number>;

type ServiceErrorCode = keyof typeof serviceErrorStatuses;

function serviceFailure(
  code: ServiceErrorCode,
  message: string,
): TrpcResponse<never, ServiceErrorCode> {
  return fail(code, serviceErrorStatuses[code], message);
}

function unexpectedFailure(
  error: unknown,
  message: string,
): TrpcResponse<never> {
  const normalized = normalizeError(error);
  return fail(normalized.code, normalized.status, message);
}

/**
 * Customer-side quotes (M3-W1): the C4 comparator lists the PENDING offers of
 * an own request, C5 opens one in detail and `accept` closes the deal creating
 * the SERVICE Order. Tenant always comes from the session; a foreign request
 * or quote answers a generic NOT_FOUND.
 */
export const quoteRouter = createTRPCRouter({
  listByRequest: userProcedure
    .input(listByRequestSchema)
    .query(async ({ ctx, input }) => {
      try {
        const list = await listQuotesByRequest(ctx.db, {
          customerId: ctx.customer.id,
          requestId: input.requestId,
          sort: input.sort,
        });

        if (!list.ok) {
          return serviceFailure(list.code, "Request not found");
        }

        return ok(list.data, "Quotes loaded");
      } catch (error) {
        return unexpectedFailure(error, "Quote list failed");
      }
    }),

  getById: userProcedure.input(quoteIdSchema).query(async ({ ctx, input }) => {
    try {
      const quote = await getMyQuote(ctx.db, {
        customerId: ctx.customer.id,
        quoteId: input.id,
      });

      if (!quote.ok) {
        return serviceFailure(quote.code, "Quote not found");
      }

      return ok(quote.data, "Quote loaded");
    } catch (error) {
      return unexpectedFailure(error, "Quote load failed");
    }
  }),

  accept: userProcedure
    .input(quoteIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const accepted = await acceptQuote(ctx.db, {
          customerId: ctx.customer.id,
          quoteId: input.id,
        });

        if (!accepted.ok) {
          return serviceFailure(accepted.code, "Quote accept failed");
        }

        return ok(accepted.data, "Quote accepted", 201);
      } catch (error) {
        return unexpectedFailure(error, "Quote accept failed");
      }
    }),
});
