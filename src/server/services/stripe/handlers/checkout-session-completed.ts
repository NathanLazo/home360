import "server-only";

import { PaymentLinkStatus } from "@generated/prisma";
import Stripe from "stripe";

import { svcOk } from "~/server/services/service-result";
import type { StripeEventHandler } from "../webhook-dispatcher";
import { capturePaymentIntent } from "./payment-intent-succeeded";
import {
  checkoutSessionMetadataSchema,
  expandableId,
  handlerFail,
} from "./shared";

export const handleCheckoutSessionCompleted: StripeEventHandler = async (
  deps,
  event,
) => {
  if (event.type !== "checkout.session.completed") {
    return svcOk(null);
  }

  const session = event.data.object;

  // Billing Checkout Sessions (subscriptions) are handled elsewhere.
  if (session.mode !== "payment") {
    return svcOk(null);
  }

  const metadata = checkoutSessionMetadataSchema.safeParse(
    session.metadata ?? {},
  );

  if (!metadata.success) {
    return handlerFail(
      "INVALID_SESSION_METADATA",
      `Checkout Session ${session.id} carries unreadable metadata`,
    );
  }

  const paymentLinkId = metadata.data.paymentLinkId;

  if (paymentLinkId === undefined) {
    return svcOk(null);
  }

  // A completed but unpaid Session must not mark the link as paid.
  if (session.payment_status !== "paid") {
    return svcOk(null);
  }

  const stripePaymentLinkId = expandableId(session.payment_link);

  if (stripePaymentLinkId === null) {
    return handlerFail(
      "SESSION_PAYMENT_LINK_MISSING",
      `Checkout Session ${session.id} has no payment_link id`,
    );
  }

  const { db, stripe } = deps;
  const paymentLink = await db.paymentLink.findUnique({
    where: { id: paymentLinkId },
    select: {
      id: true,
      businessId: true,
      amountCents: true,
      serviceFeeCentsApplied: true,
      status: true,
      paidAt: true,
      stripePaymentLinkId: true,
    },
  });

  if (paymentLink === null) {
    return handlerFail(
      "PAYMENT_LINK_NOT_FOUND",
      `Payment link ${paymentLinkId} does not exist`,
    );
  }

  if (paymentLink.stripePaymentLinkId !== stripePaymentLinkId) {
    return handlerFail(
      "PAYMENT_LINK_MISMATCH",
      `Payment link ${paymentLink.id} is not ${stripePaymentLinkId}`,
    );
  }

  // The row owns the tenant; metadata may only agree with it.
  if (
    metadata.data.businessId !== undefined &&
    metadata.data.businessId !== paymentLink.businessId
  ) {
    return handlerFail(
      "TENANT_MISMATCH",
      `Payment link ${paymentLink.id} belongs to another business`,
    );
  }

  if (session.currency !== "mxn") {
    return handlerFail(
      "UNSUPPORTED_CURRENCY",
      `Checkout Session ${session.id} settled in ${session.currency ?? "none"}`,
    );
  }

  const expectedTotalCents =
    paymentLink.amountCents + paymentLink.serviceFeeCentsApplied;

  if (session.amount_total !== expectedTotalCents) {
    return handlerFail(
      "AMOUNT_MISMATCH",
      `Checkout Session ${session.id} paid ${String(session.amount_total)} instead of ${String(expectedTotalCents)}`,
    );
  }

  await db.paymentLink.updateMany({
    where: {
      id: paymentLink.id,
      businessId: paymentLink.businessId,
      stripePaymentLinkId,
      paidAt: null,
      status: PaymentLinkStatus.ACTIVE,
    },
    data: { paidAt: new Date(), status: PaymentLinkStatus.INACTIVE },
  });

  const settled = await db.paymentLink.findUnique({
    where: { id: paymentLink.id },
    select: { status: true, paidAt: true },
  });

  if (settled === null) {
    return handlerFail(
      "PAYMENT_LINK_NOT_FOUND",
      `Payment link ${paymentLink.id} disappeared while settling`,
    );
  }

  // Absolute check instead of trusting the conditional write: a redelivery of
  // the same event finds the link already settled and continues.
  if (
    settled.paidAt === null ||
    settled.status !== PaymentLinkStatus.INACTIVE
  ) {
    return handlerFail(
      "PAYMENT_LINK_NOT_SETTLED",
      `Payment link ${paymentLink.id} could not be marked as paid`,
    );
  }

  const paymentIntentId = expandableId(session.payment_intent);

  if (paymentIntentId === null) {
    return handlerFail(
      "SESSION_PAYMENT_INTENT_MISSING",
      `Checkout Session ${session.id} has no payment_intent id`,
    );
  }

  let paymentIntent: Stripe.PaymentIntent;

  try {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return handlerFail(
        "STRIPE_ERROR",
        `PaymentIntent ${paymentIntentId} could not be retrieved`,
      );
    }

    throw error;
  }

  // Covers the reverse ordering: if payment_intent.succeeded already captured
  // the payment, capturePayment returns the existing row without side effects.
  return capturePaymentIntent(deps, paymentIntent, {
    paymentLinkId: paymentLink.id,
  });
};
