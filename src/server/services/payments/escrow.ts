import "server-only";

import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from "../../../../generated/prisma";
import Stripe from "stripe";

import { providerTransferCents } from "~/server/services/payments/payment-ledger";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;
const MAX_PRISMA_INT = 2_147_483_647;
const RELEASE_BATCH_SIZE = 100;
const CAPTURE_MAX_SERIALIZABLE_ATTEMPTS = 3;

export const capturePaymentErrorCodes = [
  "INVALID_TARGET",
  "CORPORATE_PRICING_NOT_AVAILABLE",
  "BUSINESS_NOT_ACTIVE",
] as const;

export type CapturePaymentErrorCode = (typeof capturePaymentErrorCodes)[number];

export const releasePaymentErrorCodes = [
  "PAYMENT_NOT_RELEASABLE",
  "NO_CONNECT_ACCOUNT",
  "DISPUTE_OPEN",
] as const;

export type ReleasePaymentErrorCode = (typeof releasePaymentErrorCodes)[number];

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

type CommissionDb = Pick<PrismaClient, "business">;

export type CommissionResolutionErrorCode =
  "CORPORATE_PRICING_NOT_AVAILABLE" | "BUSINESS_NOT_ACTIVE";

export async function resolveCommissionPct(
  db: CommissionDb,
  input: { businessId: string; corporateAccountId: string | null },
): Promise<ServiceResult<number, CommissionResolutionErrorCode>> {
  if (input.corporateAccountId !== null) {
    return svcFail("CORPORATE_PRICING_NOT_AVAILABLE");
  }

  const business = await db.business.findUnique({
    where: { id: input.businessId },
    select: {
      subscription: {
        select: {
          status: true,
          plan: { select: { commissionPct: true } },
        },
      },
    },
  });
  const subscription = business?.subscription;

  if (subscription?.status !== "ACTIVE") {
    return svcFail("BUSINESS_NOT_ACTIVE");
  }

  if (
    !Number.isInteger(subscription.plan.commissionPct) ||
    subscription.plan.commissionPct < 0 ||
    subscription.plan.commissionPct > 100
  ) {
    return svcFail("CONFLICT", "Invalid plan commission configuration");
  }

  return svcOk(subscription.plan.commissionPct);
}

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
                payment: {
                  select: { stripePaymentIntentId: true },
                },
              },
            });

            if (!paymentLink) {
              return svcFail("INVALID_TARGET");
            }

            expectedProviderAmountCents = paymentLink.amountCents;
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

          const serviceFeeCentsApplied = settings.customerServiceFeeCents;
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

          const commissionPctApplied = commission.data;
          const commissionCents = Math.round(
            (input.providerAmountCents * commissionPctApplied) / 100,
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
    payment.status !== PaymentStatus.IN_ESCROW ||
    payment.stripeChargeId === null
  ) {
    return svcFail("PAYMENT_NOT_RELEASABLE");
  }

  if (
    payment.business.stripeAccountId === null ||
    !payment.business.payoutsEnabled
  ) {
    return svcFail("NO_CONNECT_ACCOUNT");
  }

  if (payment.order?.dispute && payment.order.dispute.status !== "RESOLVED") {
    return svcFail("DISPUTE_OPEN");
  }

  if (
    payment.providerRefundedCents !== 0 ||
    payment.serviceFeeRefundedCents !== 0 ||
    payment.refundedCents !== 0
  ) {
    return svcFail("PAYMENT_NOT_RELEASABLE");
  }

  const netCents = providerTransferCents(payment);

  if (netCents <= 0 || netCents > payment.providerAmountCents) {
    return svcFail("PAYMENT_NOT_RELEASABLE");
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
        status: PaymentStatus.IN_ESCROW,
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

const duePaymentWhere = (now: Date) =>
  ({
    status: PaymentStatus.IN_ESCROW,
    escrowReleaseAt: { lte: now },
    OR: [
      { orderId: null },
      { order: { is: { dispute: { is: null } } } },
      { order: { is: { dispute: { is: { status: "RESOLVED" } } } } },
    ],
  }) satisfies Prisma.PaymentWhereInput;

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
    orderBy: [{ escrowReleaseAt: "asc" }, { id: "asc" }],
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
    orderBy: [{ escrowReleaseAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  return svcOk({
    released,
    failed,
    hasMore: nextDuePayment !== null,
  });
}
