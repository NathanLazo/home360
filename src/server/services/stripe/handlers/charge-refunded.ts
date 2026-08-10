import "server-only";

import { PaymentStatus } from "../../../../../generated/prisma";
import Stripe from "stripe";

import { refundPayment } from "~/server/services/payments/escrow";
import { svcOk, type ServiceResult } from "~/server/services/service-result";
import type {
  StripeEventHandler,
  StripeWebhookDeps,
} from "../webhook-dispatcher";
import {
  expandableId,
  handlerFail,
  parseCents,
  refundMetadataSchema,
} from "./shared";

const REFUND_PAGE_SIZE = 100;

type RefundAllocation = {
  providerRefundCents: number;
  serviceFeeRefundCents: number;
};

type RefundablePayment = {
  id: string;
  status: PaymentStatus;
  amountCents: number;
  providerAmountCents: number;
  serviceFeeCentsApplied: number;
  providerRefundedCents: number;
  serviceFeeRefundedCents: number;
  refundedCents: number;
};

/**
 * Rebuilds the principal/service-fee split from the Refund metadata stamped by
 * the refund service.
 *
 * An externally created partial refund has no such metadata; it is reported as
 * an error instead of being split heuristically.
 */
async function resolveAllocationFromRefunds(
  { stripe }: StripeWebhookDeps,
  charge: Stripe.Charge,
  paymentId: string,
): Promise<ServiceResult<RefundAllocation>> {
  let refunds: Stripe.ApiList<Stripe.Refund>;

  try {
    refunds = await stripe.refunds.list({
      charge: charge.id,
      limit: REFUND_PAGE_SIZE,
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      return handlerFail(
        "STRIPE_ERROR",
        `Refunds of charge ${charge.id} could not be listed`,
      );
    }

    throw error;
  }

  if (refunds.has_more) {
    return handlerFail(
      "REFUND_ALLOCATION_UNAVAILABLE",
      `Charge ${charge.id} has more refunds than a single page`,
    );
  }

  let providerRefundCents = 0;
  let serviceFeeRefundCents = 0;

  for (const refund of refunds.data) {
    if (refund.status === "failed" || refund.status === "canceled") {
      continue;
    }

    const metadata = refundMetadataSchema.safeParse(refund.metadata ?? {});

    if (!metadata.success) {
      return handlerFail(
        "REFUND_ALLOCATION_UNAVAILABLE",
        `Refund ${refund.id} lacks an authorized principal/fee allocation`,
      );
    }

    if (metadata.data.paymentId !== paymentId) {
      return handlerFail(
        "REFUND_ALLOCATION_UNAVAILABLE",
        `Refund ${refund.id} references another payment`,
      );
    }

    const provider = parseCents(metadata.data.providerRefundCents);
    const serviceFee = parseCents(metadata.data.serviceFeeRefundCents);

    if (provider === undefined || serviceFee === undefined) {
      return handlerFail(
        "REFUND_ALLOCATION_UNAVAILABLE",
        `Refund ${refund.id} carries an unreadable allocation`,
      );
    }

    if (provider + serviceFee !== refund.amount) {
      return handlerFail(
        "REFUND_ALLOCATION_MISMATCH",
        `Refund ${refund.id} allocation does not add up to its amount`,
      );
    }

    providerRefundCents += provider;
    serviceFeeRefundCents += serviceFee;
  }

  return svcOk({ providerRefundCents, serviceFeeRefundCents });
}

async function resolveAllocation(
  deps: StripeWebhookDeps,
  charge: Stripe.Charge,
  payment: RefundablePayment,
): Promise<ServiceResult<RefundAllocation>> {
  // A refund of the whole charge is unambiguous: it returns the principal and
  // the whole flat service fee, so no metadata is required.
  if (charge.amount_refunded === payment.amountCents) {
    return svcOk({
      providerRefundCents: payment.providerAmountCents,
      serviceFeeRefundCents: payment.serviceFeeCentsApplied,
    });
  }

  const allocation = await resolveAllocationFromRefunds(
    deps,
    charge,
    payment.id,
  );

  if (!allocation.ok) {
    return allocation;
  }

  const total =
    allocation.data.providerRefundCents + allocation.data.serviceFeeRefundCents;

  if (total !== charge.amount_refunded) {
    return handlerFail(
      "REFUND_ALLOCATION_MISMATCH",
      `Charge ${charge.id} refunded ${String(charge.amount_refunded)} but the allocation adds up to ${String(total)}`,
    );
  }

  if (
    allocation.data.providerRefundCents > payment.providerAmountCents ||
    allocation.data.serviceFeeRefundCents > payment.serviceFeeCentsApplied
  ) {
    return handlerFail(
      "REFUND_ALLOCATION_MISMATCH",
      `Charge ${charge.id} allocation exceeds the payment ledger`,
    );
  }

  return allocation;
}

export const handleChargeRefunded: StripeEventHandler = async (deps, event) => {
  if (event.type !== "charge.refunded") {
    return svcOk(null);
  }

  const charge = event.data.object;
  const stripePaymentIntentId = expandableId(charge.payment_intent);

  if (stripePaymentIntentId === null) {
    return svcOk(null);
  }

  const payment = await deps.db.payment.findUnique({
    where: { stripePaymentIntentId },
    select: {
      id: true,
      status: true,
      amountCents: true,
      providerAmountCents: true,
      serviceFeeCentsApplied: true,
      providerRefundedCents: true,
      serviceFeeRefundedCents: true,
      refundedCents: true,
    },
  });

  // Refunds of charges this application does not own (for example Billing).
  if (payment === null) {
    return svcOk(null);
  }

  if (
    !Number.isSafeInteger(charge.amount_refunded) ||
    charge.amount_refunded <= 0
  ) {
    return svcOk(null);
  }

  // A released payment already moved the principal to the Connect account.
  // Reversing that requires a Transfer Reversal, which is out of scope: never
  // mutate the ledger, surface the event for operational attention instead.
  if (payment.status === PaymentStatus.RELEASED) {
    return handlerFail(
      "PAYMENT_NOT_REFUNDABLE",
      `Payment ${payment.id} is RELEASED; a transfer reversal must be handled manually`,
    );
  }

  const allocation = await resolveAllocation(deps, charge, payment);

  if (!allocation.ok) {
    return handlerFail(allocation.code, allocation.detail);
  }

  // Absolute reconciliation: an already settled ledger that matches the charge
  // is a redelivery, not a new refund.
  if (
    payment.status === PaymentStatus.REFUNDED ||
    payment.status === PaymentStatus.PARTIALLY_REFUNDED
  ) {
    return payment.providerRefundedCents ===
      allocation.data.providerRefundCents &&
      payment.serviceFeeRefundedCents ===
        allocation.data.serviceFeeRefundCents &&
      payment.refundedCents === charge.amount_refunded
      ? svcOk(null)
      : handlerFail(
          "REFUND_LEDGER_MISMATCH",
          `Payment ${payment.id} ledger disagrees with charge ${charge.id}`,
        );
  }

  const isFull =
    allocation.data.providerRefundCents === payment.providerAmountCents &&
    allocation.data.serviceFeeRefundCents === payment.serviceFeeCentsApplied;
  const refund = await refundPayment(
    deps,
    isFull
      ? { paymentId: payment.id }
      : {
          paymentId: payment.id,
          providerRefundCents: allocation.data.providerRefundCents,
          serviceFeeRefundCents: allocation.data.serviceFeeRefundCents,
        },
  );

  return refund.ok ? svcOk(null) : handlerFail(refund.code, refund.detail);
};
