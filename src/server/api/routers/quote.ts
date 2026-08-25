import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import {
  activeBusinessProcedure,
  createTRPCRouter,
  userProcedure,
} from "~/server/api/trpc";
import {
  submitQuote,
  withdrawQuote,
} from "~/server/services/orders/quote-business";
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

const submitSchema = z.object({
  requestId: z.string().cuid(),
  priceCents: z.number().int().positive(),
  scheduledAt: z.coerce.date(),
  workerId: z.string().cuid(),
  branchId: z.string().cuid().optional(),
});

/** HTTP status per service code surfaced by the quote services. */
const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
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
 * Quotes router: customer side (M3-W1 — list/get/accept) plus business side
 * (M5-W1 — submit/withdraw). Tenant always from the session; foreign resources
 * answer a generic NOT_FOUND.
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

  submit: activeBusinessProcedure
    .input(submitSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const submitted = await submitQuote(ctx.db, {
          businessId: ctx.business.id,
          userId: ctx.session.user.id,
          requestId: input.requestId,
          priceCents: input.priceCents,
          scheduledAt: input.scheduledAt,
          workerId: input.workerId,
          branchId: input.branchId,
        });

        if (!submitted.ok) {
          return serviceFailure(submitted.code, "Quote submit failed");
        }

        return ok(submitted.data, "Quote submitted", 201);
      } catch (error) {
        return unexpectedFailure(error, "Quote submit failed");
      }
    }),

  withdraw: activeBusinessProcedure
    .input(quoteIdSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const withdrawn = await withdrawQuote(ctx.db, {
          businessId: ctx.business.id,
          quoteId: input.id,
        });

        if (!withdrawn.ok) {
          return serviceFailure(withdrawn.code, "Quote withdraw failed");
        }

        return ok(withdrawn.data, "Quote withdrawn");
      } catch (error) {
        return unexpectedFailure(error, "Quote withdraw failed");
      }
    }),
});
