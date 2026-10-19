import { z } from "zod";

import { FulfillmentMethod } from "@generated/prisma";
import { env } from "~/env";
import {
  fail,
  normalizeError,
  ok,
  type TrpcResponse,
} from "~/server/api/contract";
import { consumerProcedure } from "~/server/api/consumer-procedure";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import {
  createServiceCheckoutIntent,
  listCustomerPaymentMethods,
} from "~/server/services/payments/customer-checkout";
import { createProductCheckoutIntent } from "~/server/services/payments/product-checkout";
import { getStripe } from "~/server/services/stripe/client";

const createIntentSchema = z.object({ orderId: z.string().cuid() });

/**
 * D10-1: DELIVERY needs an own `addressId`; PICKUP needs the chosen
 * `branchId`. `fulfillmentMethod` defaults to DELIVERY so pre-F10 clients
 * (address only) keep working.
 */
const createProductIntentSchema = z
  .object({
    productId: z.string().cuid(),
    quantity: z.number().int().min(1).max(100),
    fulfillmentMethod: z
      .nativeEnum(FulfillmentMethod)
      .default(FulfillmentMethod.DELIVERY),
    addressId: z.string().cuid().optional(),
    branchId: z.string().cuid().optional(),
  })
  .refine(
    (input) =>
      input.fulfillmentMethod !== FulfillmentMethod.DELIVERY ||
      input.addressId !== undefined,
    { message: "DELIVERY requires an address", path: ["addressId"] },
  )
  .refine(
    (input) =>
      input.fulfillmentMethod !== FulfillmentMethod.PICKUP ||
      input.branchId !== undefined,
    { message: "PICKUP requires a branch", path: ["branchId"] },
  );

const serviceErrorStatuses = {
  NOT_FOUND: 404,
  CONFLICT: 409,
  BUSINESS_NOT_ACTIVE: 409,
  STRIPE_ERROR: 502,
  VALIDATION_ERROR: 422,
  OUT_OF_STOCK: 409,
  PICKUP_NOT_AVAILABLE: 409,
  DELIVERY_NOT_AVAILABLE: 409,
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

/**
 * Customer PaymentSheet endpoints for service and direct-product checkout.
 * `createIntent` pays or retries any own PENDING order (SERVICE or PRODUCT,
 * D10-7); `createProductIntent` is idempotent and returns the `orderId`.
 */
export const checkoutRouter = createTRPCRouter({
  createIntent: consumerProcedure
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
          fulfillmentMethod: input.fulfillmentMethod,
          addressId: input.addressId,
          branchId: input.branchId,
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

  listPaymentMethods: consumerProcedure.query(async ({ ctx }) => {
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
