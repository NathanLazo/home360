import "server-only";

import { PaymentStatus, WithdrawalStatus } from "../../../../generated/prisma";
import type { Payment } from "../../../../generated/prisma";

import {
  platformGrossRevenueCents,
  providerTransferCents,
  type PlatformRevenueLedger,
  type ProviderTransferLedger,
} from "./payment-ledger";

/**
 * XC-27 — shared projection contract over the XC-25 payment ledger.
 *
 * This module owns the eligible status sets and the typed bases every
 * financial screen (W3, W6, W9, W12) projects from. It never queries Prisma:
 * each consumer applies its own tenant and period filters in its own query and
 * feeds the aggregated ledger columns into these helpers.
 *
 * Event-field contract (calendar-month ranges, one event field per series):
 * - `Payment` series bucket by `Payment.createdAt` (charge time).
 * - `Invoice` series bucket by `Invoice.issuedAt`.
 * - `LoyaltyBonus` paid series bucket by `LoyaltyBonus.paidAt`.
 *
 * Payload naming contract: every amount ends in `Cents` and the escrow order
 * counter is always `escrowOrdersCount`.
 */

/**
 * W3 provider revenue base: payments whose principal was charged and is (at
 * least partially) retained. Excludes the flat service fee and the platform
 * commission — revenue is the non-refunded principal only.
 */
export const PROVIDER_REVENUE_PAYMENT_STATUSES = [
  PaymentStatus.IN_ESCROW,
  PaymentStatus.RELEASED,
  PaymentStatus.PARTIALLY_REFUNDED,
] as const;

/**
 * W6 available balance base (XC-03 net formula): only payments already
 * released to the provider, net of refunds and effective commission.
 */
export const AVAILABLE_BALANCE_PAYMENT_STATUSES = [
  PaymentStatus.RELEASED,
  PaymentStatus.PARTIALLY_REFUNDED,
] as const;

/**
 * Money still held by the platform. `REFUNDING|RELEASING` count as escrow,
 * never as available balance (PENDIENTES.md, release contract).
 */
export const ESCROW_PAYMENT_STATUSES = [
  PaymentStatus.IN_ESCROW,
  PaymentStatus.REFUNDING,
  PaymentStatus.RELEASING,
] as const;

/**
 * W9 GMV base: every payment effectively charged (left `PENDING`), gross of
 * refunds. Consumers exposing a net figure must surface `refundedCents` as a
 * separate field instead of changing this base.
 */
export const CHARGED_PAYMENT_STATUSES = [
  PaymentStatus.IN_ESCROW,
  PaymentStatus.REFUNDING,
  PaymentStatus.RELEASING,
  PaymentStatus.RELEASED,
  PaymentStatus.REFUNDED,
  PaymentStatus.PARTIALLY_REFUNDED,
] as const;

/**
 * W12 platform earning base: payments whose commission/service fee snapshots
 * count as platform income. A fully refunded payment earned nothing; a partial
 * refund already carries its effective commission and explicit refunded fee
 * portion persisted by F3-05, so reads never recompute the policy.
 */
export const PLATFORM_EARNING_PAYMENT_STATUSES = [
  PaymentStatus.IN_ESCROW,
  PaymentStatus.REFUNDING,
  PaymentStatus.RELEASING,
  PaymentStatus.RELEASED,
  PaymentStatus.PARTIALLY_REFUNDED,
] as const;

/**
 * Withdrawals that reserve available balance (XC-08). `REJECTED|FAILED|
 * CANCELED` release the reservation; each withdrawal is deducted exactly once.
 */
export const RESERVED_WITHDRAWAL_STATUSES = [
  WithdrawalStatus.REQUESTED,
  WithdrawalStatus.PROCESSING,
  WithdrawalStatus.APPROVED,
] as const;

export type ProviderRevenueLedger = Pick<
  Payment,
  "providerAmountCents" | "providerRefundedCents"
>;

// Re-export the XC-25 canonical helpers so consumers depend on one module.
export {
  platformGrossRevenueCents,
  providerTransferCents,
  type PlatformRevenueLedger,
  type ProviderTransferLedger,
};

/**
 * W3 revenue: charged principal not refunded. Works on a single payment or on
 * aggregated `_sum` columns of a `PROVIDER_REVENUE_PAYMENT_STATUSES` query.
 */
export function providerRevenueCents(ledger: ProviderRevenueLedger): number {
  return ledger.providerAmountCents - ledger.providerRefundedCents;
}

/**
 * W6 available balance: released provider net minus balance-reserving
 * withdrawals. Never clamped to zero (XC-03).
 */
export function availableBalanceCents(input: {
  releasedLedger: ProviderTransferLedger;
  reservedWithdrawalCents: number;
}): number {
  return (
    providerTransferCents(input.releasedLedger) - input.reservedWithdrawalCents
  );
}

/**
 * W12 net platform revenue: gross platform revenue (commission + non-refunded
 * flat fee) plus PAID subscription invoices minus PAID loyalty bonuses.
 * Pending bonuses never reduce paid income; expose them separately as an
 * operating liability.
 */
export function netPlatformRevenueCents(input: {
  platformGrossRevenueCents: number;
  paidSubscriptionCents: number;
  paidLoyaltyBonusCents: number;
}): number {
  return (
    input.platformGrossRevenueCents +
    input.paidSubscriptionCents -
    input.paidLoyaltyBonusCents
  );
}
