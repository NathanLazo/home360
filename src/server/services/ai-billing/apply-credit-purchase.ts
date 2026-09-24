import "server-only";

import { AiCreditPurchaseStatus, type PrismaClient } from "@generated/prisma";
import {
  svcFail,
  svcOk,
  type ServiceResult,
} from "~/server/services/service-result";

export type ApplyCreditPurchaseInput = {
  purchaseId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  amountTotalUsdCents: number | null;
  currency: string | null;
};

type ApplyErrorCode = "AMOUNT_MISMATCH" | "UNSUPPORTED_CURRENCY";

/**
 * Credits a paid pack exactly once. The conditional `updateMany` on
 * `status: PENDING` is the idempotency guard: a redelivered webhook finds the
 * row already PAID and returns success with no effect.
 */
export async function applyCreditPurchase(
  db: PrismaClient,
  input: ApplyCreditPurchaseInput,
): Promise<ServiceResult<null, ApplyErrorCode>> {
  const purchase = await db.aiCreditPurchase.findUnique({
    where: { id: input.purchaseId },
    select: {
      id: true,
      status: true,
      amountUsdCents: true,
      creditUsdMicros: true,
      businessId: true,
      corporateAccountId: true,
      stripeCheckoutSessionId: true,
    },
  });

  if (!purchase) {
    return svcFail("NOT_FOUND", "Credit purchase not found");
  }

  if (purchase.status === AiCreditPurchaseStatus.PAID) {
    return svcOk(null);
  }

  if (
    purchase.stripeCheckoutSessionId !== null &&
    purchase.stripeCheckoutSessionId !== input.stripeCheckoutSessionId
  ) {
    return svcFail("CONFLICT", "Checkout Session does not match the purchase");
  }

  if (input.currency !== "usd") {
    return svcFail("UNSUPPORTED_CURRENCY", `Settled in ${input.currency ?? "none"}`);
  }

  if (input.amountTotalUsdCents !== purchase.amountUsdCents) {
    return svcFail("AMOUNT_MISMATCH", "Paid amount differs from the pack");
  }

  await db.$transaction(async (tx) => {
    const marked = await tx.aiCreditPurchase.updateMany({
      where: { id: purchase.id, status: AiCreditPurchaseStatus.PENDING },
      data: {
        status: AiCreditPurchaseStatus.PAID,
        paidAt: new Date(),
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
      },
    });

    if (marked.count === 0) {
      return;
    }

    if (purchase.businessId) {
      await tx.business.update({
        where: { id: purchase.businessId },
        data: { aiCreditUsdMicros: { increment: purchase.creditUsdMicros } },
        select: { id: true },
      });
    } else if (purchase.corporateAccountId) {
      await tx.corporateAccount.update({
        where: { id: purchase.corporateAccountId },
        data: { aiCreditUsdMicros: { increment: purchase.creditUsdMicros } },
        select: { id: true },
      });
    }
  });

  return svcOk(null);
}
