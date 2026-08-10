import "server-only";

import { WithdrawalStatus } from "../../../../../generated/prisma";

import { svcOk } from "~/server/services/service-result";
import type {
  StripeEventHandler,
  StripeWebhookDeps,
} from "../webhook-dispatcher";
import { handlerFail, type StripeHandlerResult } from "./shared";

/**
 * Reconciles a withdrawal from its persisted `stripePayoutId`.
 *
 * `FAILED` and `CANCELED` stop reserving balance (XC-03), so an approved
 * withdrawal whose payout did not go through must not stay `APPROVED`. The
 * tenant is never read from the payout metadata.
 */
async function reconcileWithdrawal(
  { db }: StripeWebhookDeps,
  stripePayoutId: string,
  target: typeof WithdrawalStatus.FAILED | typeof WithdrawalStatus.CANCELED,
): Promise<StripeHandlerResult> {
  const withdrawal = await db.withdrawal.findUnique({
    where: { stripePayoutId },
    select: { id: true },
  });

  // Payouts created outside this application are ignored.
  if (withdrawal === null) {
    return svcOk(null);
  }

  const reconciled = await db.withdrawal.updateMany({
    where: {
      id: withdrawal.id,
      stripePayoutId,
      status: {
        in: [WithdrawalStatus.PROCESSING, WithdrawalStatus.APPROVED],
      },
    },
    data: { status: target, resolvedAt: new Date() },
  });

  if (reconciled.count > 0) {
    return svcOk(null);
  }

  const current = await db.withdrawal.findUnique({
    where: { id: withdrawal.id },
    select: { status: true },
  });

  // A redelivery finds the withdrawal already reconciled.
  if (current?.status === target) {
    return svcOk(null);
  }

  return handlerFail(
    "WITHDRAWAL_NOT_RECONCILABLE",
    `Withdrawal ${withdrawal.id} is ${current?.status ?? "missing"} and cannot become ${target}`,
  );
}

export const handlePayoutFailed: StripeEventHandler = async (deps, event) => {
  if (event.type !== "payout.failed") {
    return svcOk(null);
  }

  return reconcileWithdrawal(
    deps,
    event.data.object.id,
    WithdrawalStatus.FAILED,
  );
};

export const handlePayoutCanceled: StripeEventHandler = async (deps, event) => {
  if (event.type !== "payout.canceled") {
    return svcOk(null);
  }

  return reconcileWithdrawal(
    deps,
    event.data.object.id,
    WithdrawalStatus.CANCELED,
  );
};
