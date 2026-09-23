import "server-only";

import { OrderStatus, OrderType, type PrismaClient } from "@generated/prisma";
import Stripe from "stripe";

import { resolveCommissionPct } from "~/server/services/payments/commission-resolution";
import { ensureCustomerStripeCustomer } from "~/server/services/payments/customer-checkout";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

const MAX_PRISMA_INT = 2_147_483_647;

export type OrderCheckoutSessionDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

export type OrderCheckoutSessionInput = {
  customerId: string;
  orderId: string;
  successUrl: string;
  cancelUrl: string;
  /** Localized line-item label for the customer service fee. */
  serviceFeeLabel: string;
};

type CheckoutSessionErrorCode = "BUSINESS_NOT_ACTIVE";

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

/**
 * Web variant of the escrow checkout (workstream D, F7 corporate portal):
 * a hosted Stripe Checkout Session instead of the mobile PaymentSheet. The
 * PaymentIntent metadata points at the order, so `payment_intent.succeeded`
 * captures it through the generic `capturePayment` path (Payment IN_ESCROW,
 * commission — corporate rate included — frozen, order PAID). The idempotency
 * key keeps repeated clicks on the same session, and an order that already
 * started a PaymentSheet attempt is refused so two intents never race.
 */
export async function createOrderCheckoutSession(
  deps: OrderCheckoutSessionDeps,
  input: OrderCheckoutSessionInput,
): Promise<ServiceResult<{ url: string }, CheckoutSessionErrorCode>> {
  const order = await deps.db.order.findFirst({
    where: {
      id: input.orderId,
      customerId: input.customerId,
      type: OrderType.SERVICE,
    },
    select: {
      id: true,
      title: true,
      status: true,
      amountCents: true,
      businessId: true,
      corporateAccountId: true,
      payment: { select: { id: true } },
    },
  });

  if (!order) {
    return svcFail("NOT_FOUND", "Order not found");
  }

  if (order.status !== OrderStatus.PENDING || order.payment !== null) {
    return svcFail("CONFLICT", "Order is not pending payment");
  }

  const settings = await deps.db.platformSettings.findUnique({
    where: { id: 1 },
    select: { customerServiceFeeCents: true },
  });

  if (!settings) {
    return svcFail("CONFLICT", "Platform settings are not configured");
  }

  const totalCents = order.amountCents + settings.customerServiceFeeCents;

  if (
    !Number.isSafeInteger(order.amountCents) ||
    order.amountCents <= 0 ||
    settings.customerServiceFeeCents < 0 ||
    totalCents > MAX_PRISMA_INT
  ) {
    return svcFail("CONFLICT", "Invalid checkout amount configuration");
  }

  // Fail fast (before sending the customer to Stripe) when the provider can
  // no longer be paid; the capture repeats this resolution authoritatively.
  const commission = await resolveCommissionPct(deps.db, {
    businessId: order.businessId,
    corporateAccountId: order.corporateAccountId,
  });

  if (!commission.ok) {
    return svcFail(commission.code, commission.detail);
  }

  const customer = await ensureCustomerStripeCustomer(deps, input.customerId);

  if (!customer.ok) {
    return customer;
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      quantity: 1,
      price_data: {
        currency: "mxn",
        unit_amount: order.amountCents,
        product_data: { name: order.title },
      },
    },
  ];

  if (settings.customerServiceFeeCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "mxn",
        unit_amount: settings.customerServiceFeeCents,
        product_data: { name: input.serviceFeeLabel },
      },
    });
  }

  try {
    const session = await deps.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customer.data.stripeCustomerId,
        line_items: lineItems,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        payment_intent_data: {
          description: order.title,
          metadata: {
            orderId: order.id,
            businessId: order.businessId,
            customerId: input.customerId,
            providerAmountCents: String(order.amountCents),
            checkoutType: OrderType.SERVICE,
          },
        },
      },
      { idempotencyKey: `order-checkout-session-${order.id}` },
    );

    if (!session.url) {
      return svcFail("STRIPE_ERROR", "Checkout Session has no url");
    }

    return svcOk({ url: session.url });
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR", "Checkout Session creation failed");
    }

    throw error;
  }
}
