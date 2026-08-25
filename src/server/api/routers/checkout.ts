import { z } from "zod";

import { env } from "~/env";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import {
  createProductCheckoutIntent,
  createServiceCheckoutIntent,
  listCustomerPaymentMethods,
} from "~/server/services/payments/customer-checkout";
import { getStripe } from "~/server/services/stripe/client";

const createIntentSchema = z.object({ orderId: z.string().cuid() });

const createProductIntentSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1).max(100),
  addressId: z.string().cuid(),
});

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_NOT_ACTIVE: 409,
  STRIPE_ERROR: 502,
} as const;

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

function checkoutDeps(
  db: Parameters<typeof createServiceCheckoutIntent>[0]["db"],
) {
  return {
    db,
    stripe: getStripe(),
    publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  };
}

/** Customer PaymentSheet endpoints for service and direct-product checkout. */
export const checkoutRouter = createTRPCRouter({
  createIntent: userProcedure
    .input(createIntentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const intent = await createServiceCheckoutIntent(checkoutDeps(ctx.db), {
          customerId: ctx.customer.id,
          orderId: input.orderId,
        });

        if (!intent.ok) {
          return serviceFailure(intent.code, "Checkout intent creation failed");
        }

        return ok(intent.data, "Checkout intent created", 201);
      } catch (error) {
        return unexpectedFailure(error, "Checkout intent creation failed");
      }
    }),

  createProductIntent: userProcedure
    .input(createProductIntentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const intent = await createProductCheckoutIntent(checkoutDeps(ctx.db), {
          customerId: ctx.customer.id,
          productId: input.productId,
          quantity: input.quantity,
          addressId: input.addressId,
        });

        if (!intent.ok) {
          return serviceFailure(
            intent.code,
            "Product checkout creation failed",
          );
        }

        return ok(intent.data, "Product checkout created", 201);
      } catch (error) {
        return unexpectedFailure(error, "Product checkout creation failed");
      }
    }),

  listPaymentMethods: userProcedure.query(async ({ ctx }) => {
    try {
      const methods = await listCustomerPaymentMethods(
        { db: ctx.db, stripe: getStripe() },
        { customerId: ctx.customer.id },
      );

      if (!methods.ok) {
        return serviceFailure(methods.code, "Payment method list failed");
      }

      return ok(methods.data, "Payment methods loaded");
    } catch (error) {
      return unexpectedFailure(error, "Payment method list failed");
    }
  }),
});
