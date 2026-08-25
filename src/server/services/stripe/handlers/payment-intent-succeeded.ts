import "server-only";

import { PaymentMethod } from "../../../../../generated/prisma";
import type Stripe from "stripe";

import { capturePayment } from "~/server/services/payments/escrow";
import { finalizePendingCheckoutPayment } from "~/server/services/payments/customer-checkout";
import { svcOk, type ServiceResult } from "~/server/services/service-result";
import type {
  StripeEventHandler,
  StripeWebhookDeps,
} from "../webhook-dispatcher";
import {
  expandableId,
  handlerFail,
  parseCents,
  paymentIntentMetadataSchema,
  type StripeHandlerResult,
} from "./shared";

type CaptureOrigin = {
  businessId: string;
  providerAmountCents: number;
  method: PaymentMethod;
  orderId?: string;
  paymentLinkId?: string;
};

type CapturePaymentIntentOptions = {
  /** Set when the Checkout Session already identified the payment link row. */
  paymentLinkId?: string;
};

/**
 * Captures a succeeded PaymentIntent into the local ledger.
 *
 * Exported so `checkout.session.completed` can reuse the exact same validation
 * when the Session event arrives before the PaymentIntent event.
 */
export async function capturePaymentIntent(
  deps: StripeWebhookDeps,
  paymentIntent: Stripe.PaymentIntent,
  options: CapturePaymentIntentOptions = {},
): Promise<StripeHandlerResult> {
  if (paymentIntent.status !== "succeeded") {
    return handlerFail(
      "PAYMENT_INTENT_NOT_SUCCEEDED",
      `PaymentIntent ${paymentIntent.id} is ${paymentIntent.status}`,
    );
  }

  if (paymentIntent.currency !== "mxn") {
    return handlerFail(
      "UNSUPPORTED_CURRENCY",
      `PaymentIntent ${paymentIntent.id} settled in ${paymentIntent.currency}`,
    );
  }

  const stripeChargeId = expandableId(paymentIntent.latest_charge);

  if (stripeChargeId === null) {
    return handlerFail(
      "MISSING_CHARGE",
      `PaymentIntent ${paymentIntent.id} has no latest_charge id`,
    );
  }

  const amountCents = paymentIntent.amount_received;

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return handlerFail(
      "INVALID_AMOUNT",
      `PaymentIntent ${paymentIntent.id} received ${String(amountCents)}`,
    );
  }

  const metadata = paymentIntentMetadataSchema.safeParse(
    paymentIntent.metadata ?? {},
  );

  if (!metadata.success) {
    return handlerFail(
      "INVALID_PAYMENT_METADATA",
      `PaymentIntent ${paymentIntent.id} carries unreadable metadata`,
    );
  }

  const pendingCheckout = await finalizePendingCheckoutPayment(deps, {
    stripePaymentIntentId: paymentIntent.id,
    stripeChargeId,
    amountCents,
  });

  if (!pendingCheckout.ok) {
    return handlerFail(pendingCheckout.code, pendingCheckout.detail);
  }

  if (pendingCheckout.data.handled) {
    return svcOk(null);
  }

  const origin = await resolveCaptureOrigin(deps, metadata.data, options);

  if (!origin.ok) {
    return handlerFail(origin.code, origin.detail);
  }

  if (origin.data === null) {
    // Foreign event (for example a Billing PaymentIntent): nothing to capture.
    return svcOk(null);
  }

  const expectedProviderAmountCents = parseCents(
    metadata.data.providerAmountCents,
  );

  if (
    expectedProviderAmountCents !== undefined &&
    expectedProviderAmountCents !== origin.data.providerAmountCents
  ) {
    return handlerFail(
      "PROVIDER_AMOUNT_MISMATCH",
      `PaymentIntent ${paymentIntent.id} metadata contradicts the persisted amount`,
    );
  }

  const capture = await capturePayment(deps, {
    stripePaymentIntentId: paymentIntent.id,
    stripeChargeId,
    amountCents,
    providerAmountCents: origin.data.providerAmountCents,
    currency: "mxn",
    businessId: origin.data.businessId,
    method: origin.data.method,
    ...(origin.data.orderId !== undefined
      ? { orderId: origin.data.orderId }
      : {}),
    ...(origin.data.paymentLinkId !== undefined
      ? { paymentLinkId: origin.data.paymentLinkId }
      : {}),
  });

  return capture.ok ? svcOk(null) : handlerFail(capture.code, capture.detail);
}

/**
 * Resolves the tenant and the provider amount from the database.
 *
 * Metadata only points at a row; the persisted row decides the business and the
 * amount. Resolves to `null` data when the event does not belong to this domain.
 */
async function resolveCaptureOrigin(
  { db }: StripeWebhookDeps,
  metadata: {
    orderId?: string;
    paymentLinkId?: string;
    businessId?: string;
  },
  options: CapturePaymentIntentOptions,
): Promise<ServiceResult<CaptureOrigin | null>> {
  const paymentLinkId = metadata.paymentLinkId ?? options.paymentLinkId;

  if (
    options.paymentLinkId !== undefined &&
    metadata.paymentLinkId !== undefined &&
    metadata.paymentLinkId !== options.paymentLinkId
  ) {
    return handlerFail(
      "PAYMENT_LINK_MISMATCH",
      "PaymentIntent metadata points at a different payment link",
    );
  }

  if (metadata.orderId !== undefined && paymentLinkId !== undefined) {
    return handlerFail(
      "AMBIGUOUS_PAYMENT_ORIGIN",
      "PaymentIntent metadata declares both an order and a payment link",
    );
  }

  if (metadata.orderId !== undefined) {
    const order = await db.order.findUnique({
      where: { id: metadata.orderId },
      select: { id: true, businessId: true, amountCents: true },
    });

    if (order === null) {
      return handlerFail(
        "ORDER_NOT_FOUND",
        `Order ${metadata.orderId} does not exist`,
      );
    }

    if (
      metadata.businessId !== undefined &&
      metadata.businessId !== order.businessId
    ) {
      return handlerFail(
        "TENANT_MISMATCH",
        `Order ${order.id} belongs to another business`,
      );
    }

    return svcOk({
      businessId: order.businessId,
      providerAmountCents: order.amountCents,
      method: PaymentMethod.CARD,
      orderId: order.id,
    });
  }

  if (paymentLinkId === undefined) {
    return svcOk(null);
  }

  const paymentLink = await db.paymentLink.findUnique({
    where: { id: paymentLinkId },
    select: { id: true, businessId: true, amountCents: true },
  });

  if (paymentLink === null) {
    return handlerFail(
      "PAYMENT_LINK_NOT_FOUND",
      `Payment link ${paymentLinkId} does not exist`,
    );
  }

  if (
    metadata.businessId !== undefined &&
    metadata.businessId !== paymentLink.businessId
  ) {
    return handlerFail(
      "TENANT_MISMATCH",
      `Payment link ${paymentLink.id} belongs to another business`,
    );
  }

  return svcOk({
    businessId: paymentLink.businessId,
    providerAmountCents: paymentLink.amountCents,
    method: PaymentMethod.PAYMENT_LINK,
    paymentLinkId: paymentLink.id,
  });
}

export const handlePaymentIntentSucceeded: StripeEventHandler = async (
  deps,
  event,
) => {
  if (event.type !== "payment_intent.succeeded") {
    return svcOk(null);
  }

  return capturePaymentIntent(deps, event.data.object);
};
