import "server-only";

import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from "../../../../generated/prisma";
import Stripe from "stripe";

import {
  commissionCentsOnPrincipal,
  resolveCommissionPct,
} from "~/server/services/payments/commission-resolution";
import { providerTransferCents } from "~/server/services/payments/payment-ledger";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;
const MAX_PRISMA_INT = 2_147_483_647;
const RELEASE_BATCH_SIZE = 100;
const RELEASE_RETRY_DELAY_MILLISECONDS = 5 * 60 * 1_000;
const CAPTURE_MAX_SERIALIZABLE_ATTEMPTS = 3;

export const capturePaymentErrorCodes = [
  "INVALID_TARGET",
  "BUSINESS_NOT_ACTIVE",
] as const;

export type CapturePaymentErrorCode = (typeof capturePaymentErrorCodes)[number];

export const releasePaymentErrorCodes = [
  "PAYMENT_NOT_RELEASABLE",
  "NO_CONNECT_ACCOUNT",
  "DISPUTE_OPEN",
] as const;

export type ReleasePaymentErrorCode = (typeof releasePaymentErrorCodes)[number];

export const refundPaymentErrorCodes = [
  "PAYMENT_NOT_REFUNDABLE",
  "REFUND_EXCEEDS_LIMIT",
] as const;

export type RefundPaymentErrorCode = (typeof refundPaymentErrorCodes)[number];

export type CapturePaymentInput = {
  stripePaymentIntentId: string;
  stripeChargeId: string;
  amountCents: number;
  providerAmountCents: number;
  currency: "mxn";
  businessId: string;
  method: PaymentMethod;
  orderId?: string;
  paymentLinkId?: string;
};

type CapturePaymentDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

function hasExactlyOneOrigin(input: CapturePaymentInput): boolean {
  return (input.orderId !== undefined) !== (input.paymentLinkId !== undefined);
}

function hasValidPrimitiveInput(input: CapturePaymentInput): boolean {
  return (
    input.currency === "mxn" &&
    input.businessId.trim().length > 0 &&
    input.stripePaymentIntentId.trim().length > 0 &&
    input.stripeChargeId.trim().length > 0 &&
    Object.values(PaymentMethod).includes(input.method) &&
    Number.isSafeInteger(input.amountCents) &&
    input.amountCents > 0 &&
    input.amountCents <= MAX_PRISMA_INT &&
    Number.isSafeInteger(input.providerAmountCents) &&
    input.providerAmountCents > 0 &&
    hasExactlyOneOrigin(input)
  );
}

type ExistingPaymentSnapshot = {
  id: string;
  businessId: string;
  orderId: string | null;
  paymentLinkId: string | null;
  method: PaymentMethod;
  amountCents: number;
  providerAmountCents: number;
  stripeChargeId: string | null;
};

function matchesExistingPayment(
  payment: ExistingPaymentSnapshot,
  input: CapturePaymentInput,
): boolean {
  return (
    payment.businessId === input.businessId &&
    payment.orderId === (input.orderId ?? null) &&
    payment.paymentLinkId === (input.paymentLinkId ?? null) &&
    payment.method === input.method &&
    payment.amountCents === input.amountCents &&
    payment.providerAmountCents === input.providerAmountCents &&
    payment.stripeChargeId === input.stripeChargeId
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export async function capturePayment(
  deps: CapturePaymentDeps,
  input: CapturePaymentInput,
): Promise<ServiceResult<{ paymentId: string }, CapturePaymentErrorCode>> {
  if (!hasValidPrimitiveInput(input)) {
    return svcFail("INVALID_TARGET");
  }

  const { db } = deps;

  for (
    let attempt = 0;
    attempt < CAPTURE_MAX_SERIALIZABLE_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          let corporateAccountId: string | null = null;
          let targetPayment: {
            stripePaymentIntentId: string | null;
          } | null = null;
          let expectedProviderAmountCents: number;
          let paymentLinkServiceFeeCents: number | null = null;

          if (input.orderId !== undefined) {
            const order = await tx.order.findFirst({
              where: { id: input.orderId, businessId: input.businessId },
              select: {
                amountCents: true,
                corporateAccountId: true,
                payment: {
                  select: { stripePaymentIntentId: true },
                },
              },
            });

            if (!order) {
              return svcFail("INVALID_TARGET");
            }

            expectedProviderAmountCents = order.amountCents;
            corporateAccountId = order.corporateAccountId;
            targetPayment = order.payment;
          } else {
            if (input.paymentLinkId === undefined) {
              return svcFail("INVALID_TARGET");
            }

            const paymentLink = await tx.paymentLink.findFirst({
              where: {
                id: input.paymentLinkId,
                businessId: input.businessId,
              },
              select: {
                amountCents: true,
                serviceFeeCentsApplied: true,
                payment: {
                  select: { stripePaymentIntentId: true },
                },
              },
            });

            if (!paymentLink) {
              return svcFail("INVALID_TARGET");
            }

            expectedProviderAmountCents = paymentLink.amountCents;
            paymentLinkServiceFeeCents = paymentLink.serviceFeeCentsApplied;
            targetPayment = paymentLink.payment;
          }

          if (expectedProviderAmountCents !== input.providerAmountCents) {
            return svcFail("INVALID_TARGET");
          }

          if (
            targetPayment !== null &&
            targetPayment.stripePaymentIntentId !== input.stripePaymentIntentId
          ) {
            return svcFail("INVALID_TARGET");
          }

          const existingPayment = await tx.payment.findUnique({
            where: { stripePaymentIntentId: input.stripePaymentIntentId },
            select: {
              id: true,
              businessId: true,
              orderId: true,
              paymentLinkId: true,
              method: true,
              amountCents: true,
              providerAmountCents: true,
              stripeChargeId: true,
            },
          });

          if (existingPayment) {
            return matchesExistingPayment(existingPayment, input)
              ? svcOk({ paymentId: existingPayment.id })
              : svcFail("INVALID_TARGET");
          }

          const settings = await tx.platformSettings.findUnique({
            where: { id: 1 },
            select: {
              customerServiceFeeCents: true,
              escrowAutoReleaseHours: true,
            },
          });

          if (!settings) {
            return svcFail("CONFLICT", "Platform settings not configured");
          }

          const serviceFeeCentsApplied =
            paymentLinkServiceFeeCents ?? settings.customerServiceFeeCents;
          const escrowAutoReleaseHours = settings.escrowAutoReleaseHours;

          if (
            !Number.isSafeInteger(serviceFeeCentsApplied) ||
            serviceFeeCentsApplied < 0 ||
            !Number.isSafeInteger(escrowAutoReleaseHours) ||
            escrowAutoReleaseHours < 0 ||
            input.amountCents !==
              input.providerAmountCents + serviceFeeCentsApplied
          ) {
            return svcFail("INVALID_TARGET");
          }

          const commission = await resolveCommissionPct(tx, {
            businessId: input.businessId,
            corporateAccountId,
          });

          if (!commission.ok) {
            return svcFail(commission.code, commission.detail);
          }

          // XC-26: freeze both sides of the audit comparison at capture. The
          // effective values govern transfers, D3 bonuses and real income; the
          // provider-plan reference makes historical savings auditable even
          // after plan or corporate-term renegotiations.
          const { effectivePct, providerPlanPct, source } = commission.data;
          const commissionPctApplied = effectivePct;
          const commissionCents = commissionCentsOnPrincipal(
            input.providerAmountCents,
            effectivePct,
          );
          const providerPlanCommissionCents = commissionCentsOnPrincipal(
            input.providerAmountCents,
            providerPlanPct,
          );
          const escrowReleaseAt = new Date(
            Date.now() + escrowAutoReleaseHours * MILLISECONDS_PER_HOUR,
          );
          const payment = await tx.payment.create({
            data: {
              businessId: input.businessId,
              ...(input.orderId !== undefined
                ? { orderId: input.orderId }
                : {}),
              ...(input.paymentLinkId !== undefined
                ? { paymentLinkId: input.paymentLinkId }
                : {}),
              method: input.method,
              status: PaymentStatus.IN_ESCROW,
              amountCents: input.amountCents,
              providerAmountCents: input.providerAmountCents,
              serviceFeeCentsApplied,
              commissionPctApplied,
              commissionCents,
              providerPlanCommissionPctApplied: providerPlanPct,
              providerPlanCommissionCents,
              commissionSource: source,
              stripePaymentIntentId: input.stripePaymentIntentId,
              stripeChargeId: input.stripeChargeId,
              escrowReleaseAt,
            },
            select: { id: true },
          });

          if (input.orderId !== undefined) {
            await tx.order.updateMany({
              where: {
                id: input.orderId,
                businessId: input.businessId,
                status: "PENDING",
              },
              data: { status: "PAID" },
            });
          }

          return svcOk({ paymentId: payment.id });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (isSerializationConflict(error)) {
        if (attempt + 1 < CAPTURE_MAX_SERIALIZABLE_ATTEMPTS) {
          continue;
        }

        return svcFail("CONFLICT", "Payment capture serialization failed");
      }

      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const existingPayment = await db.payment.findUnique({
        where: { stripePaymentIntentId: input.stripePaymentIntentId },
        select: {
          id: true,
          businessId: true,
          orderId: true,
          paymentLinkId: true,
          method: true,
          amountCents: true,
          providerAmountCents: true,
          stripeChargeId: true,
        },
      });

      if (existingPayment && matchesExistingPayment(existingPayment, input)) {
        return svcOk({ paymentId: existingPayment.id });
      }

      return svcFail("INVALID_TARGET");
    }
  }

  return svcFail("CONFLICT", "Payment capture serialization failed");
}

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

export type RefundPaymentInput = {
  paymentId: string;
  providerRefundCents?: number;
  serviceFeeRefundCents?: number;
};

type RefundAllocation = {
  providerRefundedCents: number;
  serviceFeeRefundedCents: number;
  refundedCents: number;
  commissionCents: number;
  providerNetCents: number;
  isFull: boolean;
};

function resolveRefundAllocation(
  payment: {
    amountCents: number;
    providerAmountCents: number;
    serviceFeeCentsApplied: number;
    commissionPctApplied: number;
  },
  input: RefundPaymentInput,
): ServiceResult<RefundAllocation, RefundPaymentErrorCode> {
  const isFull =
    input.providerRefundCents === undefined &&
    input.serviceFeeRefundCents === undefined;
  const providerRefundedCents = isFull
    ? payment.providerAmountCents
    : input.providerRefundCents;
  const serviceFeeRefundedCents = isFull
    ? payment.serviceFeeCentsApplied
    : input.serviceFeeRefundCents;

  if (
    providerRefundedCents === undefined ||
    serviceFeeRefundedCents === undefined ||
    !Number.isSafeInteger(providerRefundedCents) ||
    !Number.isSafeInteger(serviceFeeRefundedCents) ||
    providerRefundedCents < 0 ||
    serviceFeeRefundedCents < 0 ||
    providerRefundedCents > payment.providerAmountCents ||
    serviceFeeRefundedCents > payment.serviceFeeCentsApplied
  ) {
    return svcFail("REFUND_EXCEEDS_LIMIT");
  }

  const refundedCents = providerRefundedCents + serviceFeeRefundedCents;

  if (
    refundedCents <= 0 ||
    refundedCents > payment.amountCents ||
    (!isFull && refundedCents >= payment.amountCents)
  ) {
    return svcFail("REFUND_EXCEEDS_LIMIT");
  }

  const retainedProviderCents =
    payment.providerAmountCents - providerRefundedCents;
  const commissionCents = isFull
    ? 0
    : Math.round((retainedProviderCents * payment.commissionPctApplied) / 100);
  const providerNetCents = retainedProviderCents - commissionCents;

  if (providerNetCents < 0) {
    return svcFail("REFUND_EXCEEDS_LIMIT");
  }

  return svcOk({
    providerRefundedCents,
    serviceFeeRefundedCents,
    refundedCents,
    commissionCents,
    providerNetCents,
    isFull,
  });
}

export async function refundPayment(
  { db, stripe }: CapturePaymentDeps,
  input: RefundPaymentInput,
): Promise<
  ServiceResult<
    {
      paymentId: string;
      stripeRefundId: string;
      releasedRemainderTransferId: string | null;
    },
    RefundPaymentErrorCode
  >
> {
  if (input.paymentId.trim().length === 0) {
    return svcFail("PAYMENT_NOT_REFUNDABLE");
  }

  let payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      businessId: true,
      status: true,
      amountCents: true,
      providerAmountCents: true,
      serviceFeeCentsApplied: true,
      commissionPctApplied: true,
      commissionCents: true,
      providerRefundedCents: true,
      serviceFeeRefundedCents: true,
      refundedCents: true,
      stripePaymentIntentId: true,
      stripeChargeId: true,
      stripeTransferId: true,
      business: {
        select: { stripeAccountId: true, payoutsEnabled: true },
      },
    },
  });

  if (!payment) {
    return svcFail("NOT_FOUND");
  }

  const allocation = resolveRefundAllocation(payment, input);

  if (!allocation.ok) {
    return allocation;
  }

  if (payment.status === PaymentStatus.IN_ESCROW) {
    const claimed = await db.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.IN_ESCROW,
        providerRefundedCents: 0,
        serviceFeeRefundedCents: 0,
        refundedCents: 0,
        stripeTransferId: null,
      },
      data: {
        status: PaymentStatus.REFUNDING,
        providerRefundedCents: allocation.data.providerRefundedCents,
        serviceFeeRefundedCents: allocation.data.serviceFeeRefundedCents,
        refundedCents: allocation.data.refundedCents,
        commissionCents: allocation.data.commissionCents,
      },
    });

    if (claimed.count === 0) {
      payment = await db.payment.findUnique({
        where: { id: input.paymentId },
        select: {
          id: true,
          businessId: true,
          status: true,
          amountCents: true,
          providerAmountCents: true,
          serviceFeeCentsApplied: true,
          commissionPctApplied: true,
          commissionCents: true,
          providerRefundedCents: true,
          serviceFeeRefundedCents: true,
          refundedCents: true,
          stripePaymentIntentId: true,
          stripeChargeId: true,
          stripeTransferId: true,
          business: {
            select: { stripeAccountId: true, payoutsEnabled: true },
          },
        },
      });
    } else {
      payment = {
        ...payment,
        status: PaymentStatus.REFUNDING,
        providerRefundedCents: allocation.data.providerRefundedCents,
        serviceFeeRefundedCents: allocation.data.serviceFeeRefundedCents,
        refundedCents: allocation.data.refundedCents,
        commissionCents: allocation.data.commissionCents,
      };
    }
  }

  if (
    payment?.status !== PaymentStatus.REFUNDING ||
    payment.providerRefundedCents !== allocation.data.providerRefundedCents ||
    payment.serviceFeeRefundedCents !==
      allocation.data.serviceFeeRefundedCents ||
    payment.refundedCents !== allocation.data.refundedCents ||
    payment.commissionCents !== allocation.data.commissionCents ||
    payment.stripePaymentIntentId === null
  ) {
    return svcFail("PAYMENT_NOT_REFUNDABLE");
  }

  let refund: Stripe.Refund;

  try {
    refund = await stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        amount: allocation.data.refundedCents,
        metadata: {
          paymentId: payment.id,
          providerRefundCents: allocation.data.providerRefundedCents,
          serviceFeeRefundCents: allocation.data.serviceFeeRefundedCents,
        },
      },
      {
        idempotencyKey: allocation.data.isFull
          ? `refund-full-${payment.id}`
          : `refund-partial-${payment.id}`,
      },
    );
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }

  if (allocation.data.isFull) {
    const finalized = await db.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.REFUNDING,
        providerRefundedCents: allocation.data.providerRefundedCents,
        serviceFeeRefundedCents: allocation.data.serviceFeeRefundedCents,
        refundedCents: allocation.data.refundedCents,
        commissionCents: 0,
        stripeTransferId: null,
      },
      data: { status: PaymentStatus.REFUNDED },
    });

    if (finalized.count === 0) {
      return svcFail("CONFLICT", "Payment refund claim was lost");
    }

    return svcOk({
      paymentId: payment.id,
      stripeRefundId: refund.id,
      releasedRemainderTransferId: null,
    });
  }

  let transfer: Stripe.Transfer | null = null;

  if (allocation.data.providerNetCents > 0) {
    if (
      payment.stripeChargeId === null ||
      payment.business.stripeAccountId === null ||
      !payment.business.payoutsEnabled
    ) {
      return svcFail(
        "CONFLICT",
        "Provider account cannot receive the refund remainder",
      );
    }

    try {
      transfer = await stripe.transfers.create(
        {
          amount: allocation.data.providerNetCents,
          currency: "mxn",
          destination: payment.business.stripeAccountId,
          transfer_group: `payment_${payment.id}`,
          source_transaction: payment.stripeChargeId,
          metadata: { paymentId: payment.id, operation: "refund_remainder" },
        },
        { idempotencyKey: `transfer-refund-remainder-${payment.id}` },
      );
    } catch (error) {
      if (isStripeError(error)) {
        return svcFail("STRIPE_ERROR");
      }

      throw error;
    }
  }

  const settings = await db.platformSettings.findUnique({
    where: { id: 1 },
    select: { loyaltyBonusPct: true },
  });
  const loyaltyBonusPct = settings?.loyaltyBonusPct ?? 50;

  if (
    !Number.isInteger(loyaltyBonusPct) ||
    loyaltyBonusPct < 0 ||
    loyaltyBonusPct > 100
  ) {
    return svcFail("CONFLICT", "Invalid loyalty bonus configuration");
  }

  return db.$transaction(async (tx) => {
    const releasedAt = new Date();
    const finalized = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.REFUNDING,
        providerRefundedCents: allocation.data.providerRefundedCents,
        serviceFeeRefundedCents: allocation.data.serviceFeeRefundedCents,
        refundedCents: allocation.data.refundedCents,
        commissionCents: allocation.data.commissionCents,
        stripeTransferId: null,
      },
      data: {
        status: PaymentStatus.PARTIALLY_REFUNDED,
        stripeTransferId: transfer?.id ?? null,
        releasedAt,
      },
    });

    if (finalized.count === 0) {
      return svcFail("CONFLICT", "Payment refund claim was lost");
    }

    await tx.loyaltyBonus.createMany({
      data: [
        {
          paymentId: payment.id,
          businessId: payment.businessId,
          pctApplied: loyaltyBonusPct,
          amountCents: Math.round(
            (allocation.data.commissionCents * loyaltyBonusPct) / 100,
          ),
          status: "PENDING",
        },
      ],
      skipDuplicates: true,
    });

    return svcOk({
      paymentId: payment.id,
      stripeRefundId: refund.id,
      releasedRemainderTransferId: transfer?.id ?? null,
    });
  });
}

export async function releasePayment(
  { db, stripe }: CapturePaymentDeps,
  input: { paymentId: string },
): Promise<
  ServiceResult<
    { paymentId: string; stripeTransferId: string },
    ReleasePaymentErrorCode
  >
> {
  const payment = await db.payment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      businessId: true,
      status: true,
      stripeChargeId: true,
      stripeTransferId: true,
      providerAmountCents: true,
      providerRefundedCents: true,
      serviceFeeRefundedCents: true,
      refundedCents: true,
      commissionCents: true,
      business: {
        select: { stripeAccountId: true, payoutsEnabled: true },
      },
      order: {
        select: { dispute: { select: { status: true } } },
      },
    },
  });

  if (!payment) {
    return svcFail("NOT_FOUND");
  }

  if (
    payment.status === PaymentStatus.RELEASED &&
    payment.stripeTransferId !== null
  ) {
    return svcOk({
      paymentId: payment.id,
      stripeTransferId: payment.stripeTransferId,
    });
  }

  if (
    (payment.status !== PaymentStatus.IN_ESCROW &&
      payment.status !== PaymentStatus.RELEASING) ||
    payment.stripeChargeId === null
  ) {
    if (payment.status === PaymentStatus.IN_ESCROW) {
      await db.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.IN_ESCROW },
        data: { escrowReleaseAttemptedAt: new Date() },
      });
    }

    return svcFail("PAYMENT_NOT_RELEASABLE");
  }

  if (payment.order?.dispute && payment.order.dispute.status !== "RESOLVED") {
    return svcFail("DISPUTE_OPEN");
  }

  if (
    payment.providerRefundedCents !== 0 ||
    payment.serviceFeeRefundedCents !== 0 ||
    payment.refundedCents !== 0
  ) {
    await db.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [PaymentStatus.IN_ESCROW, PaymentStatus.RELEASING],
        },
      },
      data: { escrowReleaseAttemptedAt: new Date() },
    });

    return svcFail("PAYMENT_NOT_RELEASABLE");
  }

  const netCents = providerTransferCents(payment);

  if (netCents <= 0 || netCents > payment.providerAmountCents) {
    await db.payment.updateMany({
      where: {
        id: payment.id,
        status: {
          in: [PaymentStatus.IN_ESCROW, PaymentStatus.RELEASING],
        },
      },
      data: { escrowReleaseAttemptedAt: new Date() },
    });

    return svcFail("PAYMENT_NOT_RELEASABLE");
  }

  const releaseAttemptedAt = new Date();

  if (payment.status === PaymentStatus.IN_ESCROW) {
    const claimed = await db.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.IN_ESCROW,
        stripeTransferId: null,
        stripeChargeId: { not: null },
        providerRefundedCents: 0,
        serviceFeeRefundedCents: 0,
        refundedCents: 0,
        OR: [
          { orderId: null },
          { order: { is: { dispute: { is: null } } } },
          { order: { is: { dispute: { is: { status: "RESOLVED" } } } } },
        ],
      },
      data: {
        status: PaymentStatus.RELEASING,
        escrowReleaseAttemptedAt: releaseAttemptedAt,
      },
    });

    if (claimed.count === 0) {
      const current = await db.payment.findUnique({
        where: { id: payment.id },
        select: { status: true, stripeTransferId: true },
      });

      if (
        current?.status === PaymentStatus.RELEASED &&
        current.stripeTransferId !== null
      ) {
        return svcOk({
          paymentId: payment.id,
          stripeTransferId: current.stripeTransferId,
        });
      }

      if (current?.status !== PaymentStatus.RELEASING) {
        return svcFail(
          "CONFLICT",
          "Payment release claim failed because its ledger changed",
        );
      }
    }
  } else {
    await db.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.RELEASING,
        stripeTransferId: null,
      },
      data: { escrowReleaseAttemptedAt: releaseAttemptedAt },
    });
  }

  if (
    payment.business.stripeAccountId === null ||
    !payment.business.payoutsEnabled
  ) {
    return svcFail("NO_CONNECT_ACCOUNT");
  }

  const settings = await db.platformSettings.findUnique({
    where: { id: 1 },
    select: { loyaltyBonusPct: true },
  });
  const loyaltyBonusPct = settings?.loyaltyBonusPct ?? 50;

  if (
    !Number.isInteger(loyaltyBonusPct) ||
    loyaltyBonusPct < 0 ||
    loyaltyBonusPct > 100
  ) {
    return svcFail("CONFLICT", "Invalid loyalty bonus configuration");
  }

  let transfer: Stripe.Transfer;

  try {
    transfer = await stripe.transfers.create(
      {
        amount: netCents,
        currency: "mxn",
        destination: payment.business.stripeAccountId,
        transfer_group: `payment_${payment.id}`,
        source_transaction: payment.stripeChargeId,
        metadata: { paymentId: payment.id },
      },
      { idempotencyKey: `transfer-payment-${payment.id}` },
    );
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }

  return db.$transaction(async (tx) => {
    const releasedAt = new Date();
    const claimed = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: PaymentStatus.RELEASING,
        stripeTransferId: null,
      },
      data: {
        status: PaymentStatus.RELEASED,
        stripeTransferId: transfer.id,
        releasedAt,
      },
    });

    if (claimed.count === 0) {
      const current = await tx.payment.findUnique({
        where: { id: payment.id },
        select: { status: true, stripeTransferId: true },
      });

      if (
        current?.status === PaymentStatus.RELEASED &&
        current.stripeTransferId === transfer.id
      ) {
        return svcOk({
          paymentId: payment.id,
          stripeTransferId: transfer.id,
        });
      }

      return svcFail("CONFLICT", "Payment release claim was lost");
    }

    await tx.loyaltyBonus.createMany({
      data: [
        {
          paymentId: payment.id,
          businessId: payment.businessId,
          pctApplied: loyaltyBonusPct,
          amountCents: Math.round(
            (payment.commissionCents * loyaltyBonusPct) / 100,
          ),
          status: "PENDING",
        },
      ],
      skipDuplicates: true,
    });

    return svcOk({
      paymentId: payment.id,
      stripeTransferId: transfer.id,
    });
  });
}

const duePaymentWhere = (now: Date) => {
  const retryBefore = new Date(
    now.getTime() - RELEASE_RETRY_DELAY_MILLISECONDS,
  );

  return {
    escrowReleaseAt: { lte: now },
    AND: [
      {
        OR: [
          {
            status: PaymentStatus.IN_ESCROW,
            OR: [
              { escrowReleaseAttemptedAt: null },
              { escrowReleaseAttemptedAt: { lte: retryBefore } },
            ],
          },
          {
            status: PaymentStatus.RELEASING,
            escrowReleaseAttemptedAt: { lte: retryBefore },
          },
        ],
      },
      {
        OR: [
          { orderId: null },
          { order: { is: { dispute: { is: null } } } },
          { order: { is: { dispute: { is: { status: "RESOLVED" } } } } },
        ],
      },
    ],
  } satisfies Prisma.PaymentWhereInput;
};

export async function releaseDuePayments(
  deps: CapturePaymentDeps,
  input: { now?: Date } = {},
): Promise<
  ServiceResult<{ released: number; failed: number; hasMore: boolean }>
> {
  const now = input.now ?? new Date();

  if (Number.isNaN(now.getTime())) {
    return svcFail("CONFLICT", "Invalid release cutoff");
  }

  const duePayments = await deps.db.payment.findMany({
    where: duePaymentWhere(now),
    orderBy: [
      { escrowReleaseAttemptedAt: { sort: "asc", nulls: "first" } },
      { escrowReleaseAt: "asc" },
      { id: "asc" },
    ],
    take: RELEASE_BATCH_SIZE,
    select: { id: true },
  });
  let released = 0;
  let failed = 0;

  for (const payment of duePayments) {
    try {
      const result = await releasePayment(deps, { paymentId: payment.id });

      if (result.ok) {
        released += 1;
      } else {
        failed += 1;
        console.error("[release-due-payments] PAYMENT_RELEASE_FAILED", {
          paymentId: payment.id,
          code: result.code,
        });
      }
    } catch {
      failed += 1;
      console.error("[release-due-payments] PAYMENT_RELEASE_FAILED", {
        paymentId: payment.id,
        code: "UNEXPECTED_ERROR",
      });
    }
  }

  const nextDuePayment = await deps.db.payment.findFirst({
    where: duePaymentWhere(now),
    orderBy: [
      { escrowReleaseAttemptedAt: { sort: "asc", nulls: "first" } },
      { escrowReleaseAt: "asc" },
      { id: "asc" },
    ],
    select: { id: true },
  });

  return svcOk({
    released,
    failed,
    hasMore: nextDuePayment !== null,
  });
}
