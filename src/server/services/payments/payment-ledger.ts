import type { Payment } from "../../../../generated/prisma";

export type ProviderTransferLedger = Pick<
  Payment,
  "providerAmountCents" | "providerRefundedCents" | "commissionCents"
>;

export type PlatformRevenueLedger = Pick<
  Payment,
  "commissionCents" | "serviceFeeCentsApplied" | "serviceFeeRefundedCents"
>;

/** Principal still owed to the provider after refunds and platform commission. */
export function providerTransferCents(payment: ProviderTransferLedger): number {
  return (
    payment.providerAmountCents -
    payment.providerRefundedCents -
    payment.commissionCents
  );
}

/** Platform commission plus the non-refunded portion of the flat service fee. */
export function platformGrossRevenueCents(
  payment: PlatformRevenueLedger,
): number {
  return (
    payment.commissionCents +
    payment.serviceFeeCentsApplied -
    payment.serviceFeeRefundedCents
  );
}
