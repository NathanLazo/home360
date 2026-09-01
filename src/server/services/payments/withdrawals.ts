import "server-only";

import {
  AdminAuditAction,
  BusinessStatus,
  Prisma,
  type PrismaClient,
  WithdrawalStatus,
} from "@generated/prisma";
import Stripe from "stripe";

import { writeAdminAudit } from "../admin/admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { getBusinessBalances } from "./balances";

const MAX_PRISMA_INT = 2_147_483_647;
const REQUEST_MAX_SERIALIZABLE_ATTEMPTS = 2;

export type RequestWithdrawalInput = {
  businessId: string;
  amountCents: number;
  bankName: string;
  accountLast4: string;
};

export type ApproveWithdrawalErrorCode =
  "WITHDRAWAL_NOT_PENDING" | "NO_CONNECT_ACCOUNT" | "BUSINESS_SUSPENDED";

type WithdrawalDeps = {
  db: PrismaClient;
};

type ApproveWithdrawalDeps = WithdrawalDeps & {
  stripe: Stripe;
};

function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function isStripeError(error: unknown): error is Stripe.errors.StripeError {
  return error instanceof Stripe.errors.StripeError;
}

function normalizeRequestInput(
  input: RequestWithdrawalInput,
): RequestWithdrawalInput | null {
  const businessId = input.businessId.trim();
  const bankName = input.bankName.trim();

  if (
    businessId.length === 0 ||
    !Number.isSafeInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > MAX_PRISMA_INT ||
    bankName.length < 2 ||
    bankName.length > 60 ||
    !/^\d{4}$/.test(input.accountLast4)
  ) {
    return null;
  }

  return {
    businessId,
    amountCents: input.amountCents,
    bankName,
    accountLast4: input.accountLast4,
  };
}

export async function requestWithdrawal(
  { db }: WithdrawalDeps,
  input: RequestWithdrawalInput,
): Promise<ServiceResult<{ withdrawalId: string }, "INSUFFICIENT_BALANCE">> {
  const normalized = normalizeRequestInput(input);

  if (normalized === null) {
    return svcFail("CONFLICT", "Invalid withdrawal request");
  }

  for (
    let attempt = 0;
    attempt < REQUEST_MAX_SERIALIZABLE_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await db.$transaction(
        async (tx) => {
          const business = await tx.business.findUnique({
            where: { id: normalized.businessId },
            select: { id: true },
          });

          if (business === null) {
            return svcFail("NOT_FOUND");
          }

          const balances = await getBusinessBalances(
            { db: tx },
            { businessId: normalized.businessId },
          );

          if (!balances.ok) {
            return svcFail(balances.code, balances.detail);
          }

          if (normalized.amountCents > balances.data.availableCents) {
            return svcFail("INSUFFICIENT_BALANCE");
          }

          const withdrawal = await tx.withdrawal.create({
            data: {
              businessId: normalized.businessId,
              amountCents: normalized.amountCents,
              bankName: normalized.bankName,
              accountLast4: normalized.accountLast4,
              status: WithdrawalStatus.REQUESTED,
            },
            select: { id: true },
          });

          return svcOk({ withdrawalId: withdrawal.id });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    } catch (error) {
      if (!isSerializationConflict(error)) {
        throw error;
      }

      if (attempt + 1 === REQUEST_MAX_SERIALIZABLE_ATTEMPTS) {
        return svcFail("CONFLICT", "Withdrawal serialization failed");
      }
    }
  }

  return svcFail("CONFLICT", "Withdrawal serialization failed");
}

export async function approveWithdrawal(
  { db, stripe }: ApproveWithdrawalDeps,
  input: { withdrawalId: string; adminId?: string },
): Promise<
  ServiceResult<
    { withdrawalId: string; stripePayoutId: string },
    ApproveWithdrawalErrorCode
  >
> {
  const withdrawalId = input.withdrawalId.trim();

  if (withdrawalId.length === 0) {
    return svcFail("NOT_FOUND");
  }

  const withdrawal = await db.withdrawal.findUnique({
    where: { id: withdrawalId },
    select: {
      id: true,
      amountCents: true,
      status: true,
      payoutStripeAccountId: true,
      stripePayoutId: true,
      business: {
        select: {
          status: true,
          stripeAccountId: true,
          payoutsEnabled: true,
        },
      },
    },
  });

  if (withdrawal === null) {
    return svcFail("NOT_FOUND");
  }

  if (
    withdrawal.status === WithdrawalStatus.APPROVED &&
    withdrawal.stripePayoutId !== null
  ) {
    return svcOk({
      withdrawalId: withdrawal.id,
      stripePayoutId: withdrawal.stripePayoutId,
    });
  }

  if (
    withdrawal.status !== WithdrawalStatus.REQUESTED &&
    withdrawal.status !== WithdrawalStatus.PROCESSING
  ) {
    return svcFail("WITHDRAWAL_NOT_PENDING");
  }

  if (
    !Number.isSafeInteger(withdrawal.amountCents) ||
    withdrawal.amountCents <= 0 ||
    withdrawal.amountCents > MAX_PRISMA_INT
  ) {
    return svcFail("CONFLICT", "Invalid persisted withdrawal amount");
  }

  let payoutStripeAccountId = withdrawal.payoutStripeAccountId;

  if (withdrawal.status === WithdrawalStatus.REQUESTED) {
    if (withdrawal.business.status === BusinessStatus.SUSPENDED) {
      return svcFail("BUSINESS_SUSPENDED");
    }

    if (
      withdrawal.business.stripeAccountId === null ||
      !withdrawal.business.payoutsEnabled
    ) {
      return svcFail("NO_CONNECT_ACCOUNT");
    }

    payoutStripeAccountId = withdrawal.business.stripeAccountId;
    const claimed = await db.withdrawal.updateMany({
      where: {
        id: withdrawal.id,
        status: WithdrawalStatus.REQUESTED,
        business: {
          is: {
            status: { not: BusinessStatus.SUSPENDED },
            stripeAccountId: payoutStripeAccountId,
            payoutsEnabled: true,
          },
        },
      },
      data: {
        status: WithdrawalStatus.PROCESSING,
        payoutStripeAccountId,
      },
    });

    if (claimed.count === 0) {
      const current = await db.withdrawal.findUnique({
        where: { id: withdrawal.id },
        select: {
          status: true,
          payoutStripeAccountId: true,
          stripePayoutId: true,
          business: {
            select: {
              status: true,
              stripeAccountId: true,
              payoutsEnabled: true,
            },
          },
        },
      });

      if (
        current?.status === WithdrawalStatus.APPROVED &&
        current.stripePayoutId !== null
      ) {
        return svcOk({
          withdrawalId: withdrawal.id,
          stripePayoutId: current.stripePayoutId,
        });
      }

      if (current?.status !== WithdrawalStatus.PROCESSING) {
        if (current?.status === WithdrawalStatus.REQUESTED) {
          if (current.business.status === BusinessStatus.SUSPENDED) {
            return svcFail("BUSINESS_SUSPENDED");
          }

          if (
            current.business.stripeAccountId === null ||
            !current.business.payoutsEnabled
          ) {
            return svcFail("NO_CONNECT_ACCOUNT");
          }

          return svcFail(
            "CONFLICT",
            "Business Stripe account changed during withdrawal claim",
          );
        }

        return svcFail("WITHDRAWAL_NOT_PENDING");
      }

      payoutStripeAccountId = current.payoutStripeAccountId;
    }
  }

  if (payoutStripeAccountId === null) {
    return svcFail(
      "CONFLICT",
      "Processing withdrawal is missing its Stripe account snapshot",
    );
  }

  let payout: Stripe.Payout;

  try {
    payout = await stripe.payouts.create(
      {
        amount: withdrawal.amountCents,
        currency: "mxn",
        metadata: { withdrawalId: withdrawal.id },
      },
      {
        stripeAccount: payoutStripeAccountId,
        idempotencyKey: `payout-withdrawal-${withdrawal.id}`,
      },
    );
  } catch (error) {
    if (isStripeError(error)) {
      return svcFail("STRIPE_ERROR");
    }

    throw error;
  }

  const resolvedAt = new Date();
  // The confirming write and its audit entry share one transaction so a
  // recorded approval always matches an applied one.
  const approved = await db.$transaction(async (tx) => {
    const updated = await tx.withdrawal.updateMany({
      where: {
        id: withdrawal.id,
        status: WithdrawalStatus.PROCESSING,
        stripePayoutId: null,
      },
      data: {
        status: WithdrawalStatus.APPROVED,
        stripePayoutId: payout.id,
        resolvedAt,
      },
    });

    if (updated.count > 0 && input.adminId) {
      await writeAdminAudit(tx, input.adminId, {
        action: AdminAuditAction.WITHDRAWAL_APPROVED,
        withdrawalId: withdrawal.id,
        before: { status: WithdrawalStatus.PROCESSING },
        after: { status: WithdrawalStatus.APPROVED },
        metadata: {
          amountCents: withdrawal.amountCents,
          reasonPresent: false,
        },
      });
    }

    return updated;
  });

  if (approved.count === 0) {
    const current = await db.withdrawal.findUnique({
      where: { id: withdrawal.id },
      select: { status: true, stripePayoutId: true },
    });

    if (
      current?.status === WithdrawalStatus.APPROVED &&
      current.stripePayoutId !== null
    ) {
      return svcOk({
        withdrawalId: withdrawal.id,
        stripePayoutId: current.stripePayoutId,
      });
    }

    return svcFail("WITHDRAWAL_NOT_PENDING");
  }

  return svcOk({
    withdrawalId: withdrawal.id,
    stripePayoutId: payout.id,
  });
}

export async function rejectWithdrawal(
  { db }: WithdrawalDeps,
  input: { withdrawalId: string; reason: string; adminId?: string },
): Promise<ServiceResult<{ withdrawalId: string }, "WITHDRAWAL_NOT_PENDING">> {
  const withdrawalId = input.withdrawalId.trim();
  const reason = input.reason.trim();

  if (withdrawalId.length === 0) {
    return svcFail("NOT_FOUND");
  }

  if (reason.length < 5 || reason.length > 500) {
    return svcFail("CONFLICT", "Invalid withdrawal rejection reason");
  }

  const rejected = await db.$transaction(async (tx) => {
    const updated = await tx.withdrawal.updateMany({
      where: {
        id: withdrawalId,
        status: WithdrawalStatus.REQUESTED,
      },
      data: {
        status: WithdrawalStatus.REJECTED,
        rejectionReason: reason,
        resolvedAt: new Date(),
      },
    });

    if (updated.count > 0 && input.adminId) {
      const amount = await tx.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: { amountCents: true },
      });

      await writeAdminAudit(tx, input.adminId, {
        action: AdminAuditAction.WITHDRAWAL_REJECTED,
        withdrawalId,
        before: { status: WithdrawalStatus.REQUESTED },
        after: { status: WithdrawalStatus.REJECTED },
        metadata: {
          amountCents: amount?.amountCents ?? 0,
          reasonPresent: true,
        },
      });
    }

    return updated;
  });

  if (rejected.count === 0) {
    const exists = await db.withdrawal.findUnique({
      where: { id: withdrawalId },
      select: { id: true },
    });

    return exists === null
      ? svcFail("NOT_FOUND")
      : svcFail("WITHDRAWAL_NOT_PENDING");
  }

  return svcOk({ withdrawalId });
}
