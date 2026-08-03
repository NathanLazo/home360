import {
  LoyaltyBonusStatus,
  LoyaltyPayoutMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "../../generated/prisma";
import type {
  LoyaltyBonus,
  Payment,
  Prisma,
  PrismaClient,
} from "../../generated/prisma";
import type { SeededBusinesses } from "./businesses";
import type { SeededOrders } from "./orders";
import type { SeededPlans } from "./plans";

export type SeedPaymentsInput = {
  businesses: Pick<SeededBusinesses, "garcia">;
  orders: Pick<SeededOrders, "orders">;
  plans: Pick<SeededPlans, "standard" | "settings">;
};

export type SeededPayments = {
  payments: readonly Payment[];
  bonuses: readonly LoyaltyBonus[];
};

type PaymentState = {
  status: Prisma.PaymentUncheckedCreateInput["status"];
  providerRefundedCents: number;
  serviceFeeRefundedCents: number;
  refundedCents: number;
  escrowReleaseAt: Date | null;
  releasedAt: Date | null;
};

function resolvePaymentState(
  orderStatus: Prisma.OrderUncheckedCreateInput["status"],
  providerAmountCents: number,
  serviceFeeCentsApplied: number,
  createdAt: Date,
  futureEscrowReleaseAt: Date,
): PaymentState {
  if (orderStatus === OrderStatus.COMPLETED) {
    return {
      status: PaymentStatus.RELEASED,
      providerRefundedCents: 0,
      serviceFeeRefundedCents: 0,
      refundedCents: 0,
      escrowReleaseAt: null,
      releasedAt: new Date(createdAt.getTime() + 12 * 60 * 60 * 1_000),
    };
  }

  if (orderStatus === OrderStatus.CANCELLED) {
    return {
      status: PaymentStatus.REFUNDED,
      providerRefundedCents: providerAmountCents,
      serviceFeeRefundedCents: serviceFeeCentsApplied,
      refundedCents: providerAmountCents + serviceFeeCentsApplied,
      escrowReleaseAt: null,
      releasedAt: null,
    };
  }

  if (
    orderStatus === OrderStatus.PAID ||
    orderStatus === OrderStatus.IN_PROGRESS ||
    orderStatus === OrderStatus.DISPUTED ||
    orderStatus === OrderStatus.SHIPPING
  ) {
    return {
      status: PaymentStatus.IN_ESCROW,
      providerRefundedCents: 0,
      serviceFeeRefundedCents: 0,
      refundedCents: 0,
      escrowReleaseAt: futureEscrowReleaseAt,
      releasedAt: null,
    };
  }

  throw new Error("Seed payment order status is not supported");
}

export async function seedPayments(
  prisma: PrismaClient,
  { businesses, orders, plans }: SeedPaymentsInput,
): Promise<SeededPayments> {
  const serviceFeeCentsApplied = plans.settings.customerServiceFeeCents;
  const commissionPctApplied = plans.standard.commissionPct;
  const futureEscrowReleaseAt = new Date(
    Date.now() + plans.settings.escrowAutoReleaseHours * 60 * 60 * 1_000,
  );
  const paymentMethods = [
    PaymentMethod.CARD,
    PaymentMethod.TRANSFER,
    PaymentMethod.PAYMENT_LINK,
  ] as const;
  const payableOrders = orders.orders.filter(
    (order) => order.status !== OrderStatus.PENDING,
  );

  const paymentData: (Prisma.PaymentUncheckedCreateInput & {
    orderId: string;
  })[] = payableOrders.map((order, index) => {
    const providerAmountCents = order.amountCents;
    const amountCents = providerAmountCents + serviceFeeCentsApplied;
    const method =
      paymentMethods[index % paymentMethods.length] ?? PaymentMethod.CARD;
    const commissionCents = Math.round(
      (providerAmountCents * commissionPctApplied) / 100,
    );
    const state = resolvePaymentState(
      order.status,
      providerAmountCents,
      serviceFeeCentsApplied,
      order.createdAt,
      futureEscrowReleaseAt,
    );

    return {
      id: `seed-payment-${order.id.replace("seed-order-", "")}`,
      orderId: order.id,
      paymentLinkId: null,
      businessId: order.businessId,
      method,
      amountCents,
      providerAmountCents,
      serviceFeeCentsApplied,
      commissionPctApplied,
      commissionCents,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeTransferId: null,
      createdAt: order.createdAt,
      ...state,
    };
  });

  const payments = await prisma.$transaction(
    paymentData.map(({ id, orderId, ...values }) =>
      prisma.payment.upsert({
        where: { orderId },
        create: { id, orderId, ...values },
        update: values,
      }),
    ),
  );

  const releasedPayments = payments.filter(
    (payment) => payment.status === PaymentStatus.RELEASED,
  );
  const bonusData: Prisma.LoyaltyBonusUncheckedCreateInput[] =
    releasedPayments.map((payment, index) => {
      const isVoucher = index === 0;
      const isTransfer = index === 1;
      const isPaid = isVoucher || isTransfer;

      return {
        id: `seed-bonus-${payment.id.replace("seed-payment-", "")}`,
        businessId: businesses.garcia.id,
        paymentId: payment.id,
        amountCents: Math.round(
          (payment.commissionCents * plans.settings.loyaltyBonusPct) / 100,
        ),
        pctApplied: plans.settings.loyaltyBonusPct,
        status: isPaid ? LoyaltyBonusStatus.PAID : LoyaltyBonusStatus.PENDING,
        method: isVoucher
          ? LoyaltyPayoutMethod.VOUCHER
          : isTransfer
            ? LoyaltyPayoutMethod.TRANSFER
            : null,
        paidAt: isPaid ? payment.releasedAt : null,
        notes: isPaid ? "Bono demo liquidado." : null,
      };
    });

  const bonuses = await prisma.$transaction(
    bonusData.map(({ id, paymentId, ...values }) =>
      prisma.loyaltyBonus.upsert({
        where: { paymentId },
        create: { id, paymentId, ...values },
        update: values,
      }),
    ),
  );

  return { payments, bonuses };
}
