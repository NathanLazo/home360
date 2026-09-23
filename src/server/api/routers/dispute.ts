import { z } from "zod";

import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { consumerProcedure } from "~/server/api/consumer-procedure";
import { businessProcedure, createTRPCRouter } from "~/server/api/trpc";
import {
  addDisputeArgument,
  getDisputeByOrder,
} from "~/server/services/disputes/dispute-arguments";
import { requestDisputeSummary } from "~/server/services/disputes/dispute-summary-hook";
import {
  DISPUTE_REASONS,
  openCustomerDispute,
} from "~/server/services/disputes/open-dispute";

const evidenceSchema = z.array(z.string().trim().min(1).max(500)).max(10);

const openDisputeSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().trim().min(20).max(2_000),
  evidenceUrls: evidenceSchema.default([]),
});

const orderIdSchema = z.object({ orderId: z.string().cuid() });

const addEvidenceSchema = z.object({
  orderId: z.string().cuid(),
  evidenceUrls: evidenceSchema.min(1),
});

const respondSchema = z.object({
  orderId: z.string().cuid(),
  argument: z.string().trim().min(20).max(2_000),
  evidenceUrls: evidenceSchema.default([]),
});

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  DISPUTE_OPEN: 409,
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
 * Party-side disputes (workstream D). The consumer opens and extends the
 * dispute of an own order while the escrow is held; the business answers
 * with its argument and evidence. Resolution stays in `admin.disputes`.
 */
export const disputeRouter = createTRPCRouter({
  open: consumerProcedure
    .input(openDisputeSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const opened = await openCustomerDispute(ctx.db, {
          customerId: ctx.consumer.userId,
          orderId: input.orderId,
          reason: input.reason,
          description: input.description,
          evidencePathnames: input.evidenceUrls,
        });

        if (!opened.ok) {
          return serviceFailure(opened.code, "Dispute could not be opened");
        }

        requestDisputeSummary(ctx.db, opened.data.disputeId);

        return ok(opened.data, "Dispute opened", 201);
      } catch (error) {
        return unexpectedFailure(error, "Dispute could not be opened");
      }
    }),

  getByOrder: consumerProcedure
    .input(orderIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const dispute = await getDisputeByOrder(
          ctx.db,
          { kind: "CUSTOMER", userId: ctx.consumer.userId },
          input.orderId,
        );

        if (!dispute.ok) {
          return serviceFailure(dispute.code, "Dispute not found");
        }

        return ok(dispute.data, "Dispute loaded");
      } catch (error) {
        return unexpectedFailure(error, "Dispute load failed");
      }
    }),

  addEvidence: consumerProcedure
    .input(addEvidenceSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await addDisputeArgument(
          ctx.db,
          { kind: "CUSTOMER", userId: ctx.consumer.userId },
          { orderId: input.orderId, evidencePathnames: input.evidenceUrls },
        );

        if (!updated.ok) {
          return serviceFailure(updated.code, "Evidence could not be added");
        }

        return ok(updated.data, "Evidence added");
      } catch (error) {
        return unexpectedFailure(error, "Evidence could not be added");
      }
    }),

  getForBusiness: businessProcedure
    .input(orderIdSchema)
    .query(async ({ ctx, input }) => {
      try {
        const dispute = await getDisputeByOrder(
          ctx.db,
          {
            kind: "BUSINESS",
            businessId: ctx.business.id,
            userId: ctx.session.user.id,
          },
          input.orderId,
        );

        if (!dispute.ok) {
          return serviceFailure(dispute.code, "Dispute not found");
        }

        return ok(dispute.data, "Dispute loaded");
      } catch (error) {
        return unexpectedFailure(error, "Dispute load failed");
      }
    }),

  respond: businessProcedure
    .input(respondSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const updated = await addDisputeArgument(
          ctx.db,
          {
            kind: "BUSINESS",
            businessId: ctx.business.id,
            userId: ctx.session.user.id,
          },
          {
            orderId: input.orderId,
            argument: input.argument,
            evidencePathnames: input.evidenceUrls,
          },
        );

        if (!updated.ok) {
          return serviceFailure(updated.code, "Dispute response failed");
        }

        return ok(updated.data, "Dispute response saved");
      } catch (error) {
        return unexpectedFailure(error, "Dispute response failed");
      }
    }),
});
