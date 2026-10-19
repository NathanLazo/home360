import "server-only";

import type Stripe from "stripe";

import {
  AdminAuditAction,
  DisputeResolution,
  DisputeStatus,
  OrderEventType,
  OrderStatus,
  OrderType,
  PaymentStatus,
  type PrismaClient,
} from "@generated/prisma";

import { writeAdminAudit } from "../admin/admin-audit";
import { consumeHeldStock, restoreHeldStock } from "../orders/stock-hold";
import { refundPayment, releasePayment } from "../payments/escrow";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export const MIN_JUSTIFICATION_LENGTH = 20;

export const resolveDisputeErrorCodes = [
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "RECORDING_JUSTIFICATION_REQUIRED",
  "PAYMENT_NOT_REFUNDABLE",
  "REFUND_EXCEEDS_LIMIT",
  "PAYMENT_NOT_RELEASABLE",
  "NO_CONNECT_ACCOUNT",
  "DISPUTE_OPEN",
  "STRIPE_ERROR",
] as const;

export type ResolveDisputeErrorCode = (typeof resolveDisputeErrorCodes)[number];

export type ResolveDisputeInput = {
  adminId: string;
  disputeId: string;
  resolution: DisputeResolution;
  providerRefundCents?: number;
  serviceFeeRefundCents?: number;
  justification?: string;
};

export type ResolveDisputeDeps = {
  db: PrismaClient;
  stripe: Stripe;
};

type LoadedDispute = {
  id: string;
  status: DisputeStatus;
  orderId: string;
  order: {
    id: string;
    type: OrderType;
    recordingUrl: string | null;
    recordingComplete: boolean;
    deliveryEvidenceUrls: string[];
    events: { type: OrderEventType }[];
    payment: {
      id: string;
      status: PaymentStatus;
      amountCents: number;
    } | null;
  };
};

function isNonNegativeInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isInteger(value) && value >= 0;
}

/**
 * D6 evidence state per order type (audit §6 #14). SERVICE: a complete
 * recording. PRODUCT: delivery proof photos (DELIVERY) or a redeemed pickup
 * code (PICKED_UP event, PICKUP) — products are never recorded.
 */
function hasVerifiableEvidence(dispute: LoadedDispute): boolean {
  if (dispute.order.type === OrderType.PRODUCT) {
    return (
      dispute.order.deliveryEvidenceUrls.length > 0 ||
      dispute.order.events.some(
        (event) => event.type === OrderEventType.PICKED_UP,
      )
    );
  }

  return dispute.order.recordingUrl !== null && dispute.order.recordingComplete;
}

/**
 * D6: missing evidence resolves in favour of the customer. Any other
 * resolution stays possible, but only with an explicit written justification.
 */
function requiresJustification(
  dispute: LoadedDispute,
  resolution: DisputeResolution,
): boolean {
  return (
    !hasVerifiableEvidence(dispute) &&
    resolution !== DisputeResolution.FULL_REFUND
  );
}

export async function resolveDispute(
  deps: ResolveDisputeDeps,
  input: ResolveDisputeInput,
): Promise<ServiceResult<{ id: string }, ResolveDisputeErrorCode>> {
  const dispute = await deps.db.dispute.findUnique({
    where: { id: input.disputeId },
    select: {
      id: true,
      status: true,
      orderId: true,
      order: {
        select: {
          id: true,
          type: true,
          recordingUrl: true,
          recordingComplete: true,
          deliveryEvidenceUrls: true,
          events: {
            where: { type: OrderEventType.PICKED_UP },
            select: { type: true },
          },
          payment: {
            select: { id: true, status: true, amountCents: true },
          },
        },
      },
    },
  });

  if (!dispute) {
    return svcFail("NOT_FOUND", "Dispute not found");
  }

  if (dispute.status === DisputeStatus.RESOLVED) {
    return svcFail("CONFLICT", "Dispute is already resolved");
  }

  const justification = input.justification?.trim() ?? "";

  if (
    requiresJustification(dispute, input.resolution) &&
    justification.length < MIN_JUSTIFICATION_LENGTH
  ) {
    return svcFail(
      "RECORDING_JUSTIFICATION_REQUIRED",
      "An incomplete recording requires a written justification",
    );
  }

  // For PRODUCT this records the delivery-evidence state (D6 by type).
  const recordingCompleteAtResolution = hasVerifiableEvidence(dispute);
  const notes = justification.length > 0 ? justification : null;

  if (input.resolution === DisputeResolution.MORE_EVIDENCE) {
    return moveToReview(deps, {
      adminId: input.adminId,
      dispute,
      notes,
      recordingCompleteAtResolution,
    });
  }

  const payment = dispute.order.payment;

  // Every monetary resolution requires escrowed money. RELEASING is a conflict
  // on purpose: the claim before the Transfer is the local point of no return.
  if (payment?.status !== PaymentStatus.IN_ESCROW) {
    return svcFail("CONFLICT", "Payment is not in escrow");
  }

  if (input.resolution === DisputeResolution.RELEASE_PAYMENT) {
    const released = await releasePayment(deps, { paymentId: payment.id });

    if (!released.ok) {
      return svcFail(released.code, released.detail);
    }

    return finalize(deps, {
      adminId: input.adminId,
      dispute,
      resolution: input.resolution,
      resolutionAmountCents: 0,
      orderStatus: OrderStatus.COMPLETED,
      notes,
      recordingCompleteAtResolution,
    });
  }

  if (input.resolution === DisputeResolution.FULL_REFUND) {
    // Omitting both components is F3's contract for a total refund: principal
    // plus the whole service fee.
    const refunded = await refundPayment(deps, { paymentId: payment.id });

    if (!refunded.ok) {
      return svcFail(refunded.code, refunded.detail);
    }

    return finalize(deps, {
      adminId: input.adminId,
      dispute,
      resolution: input.resolution,
      resolutionAmountCents: payment.amountCents,
      orderStatus: OrderStatus.CANCELLED,
      notes,
      recordingCompleteAtResolution,
    });
  }

  const { providerRefundCents, serviceFeeRefundCents } = input;

  if (
    !isNonNegativeInteger(providerRefundCents) ||
    !isNonNegativeInteger(serviceFeeRefundCents)
  ) {
    return svcFail(
      "VALIDATION_ERROR",
      "A partial refund must state both principal and service fee components",
    );
  }

  if (providerRefundCents + serviceFeeRefundCents === 0) {
    return svcFail("VALIDATION_ERROR", "A partial refund must be positive");
  }

  // The proportional commission, the upper bound and its stable error code all
  // come from F3-05: F5 never restates that formula.
  const refunded = await refundPayment(deps, {
    paymentId: payment.id,
    providerRefundCents,
    serviceFeeRefundCents,
  });

  if (!refunded.ok) {
    return svcFail(refunded.code, refunded.detail);
  }

  return finalize(deps, {
    adminId: input.adminId,
    dispute,
    resolution: input.resolution,
    resolutionAmountCents: providerRefundCents + serviceFeeRefundCents,
    orderStatus: OrderStatus.COMPLETED,
    notes,
    recordingCompleteAtResolution,
  });
}

/**
 * `MORE_EVIDENCE` is not terminal: it moves the dispute to review and never
 * writes `resolution` or `resolvedAt`, and it never touches Stripe.
 */
async function moveToReview(
  deps: Pick<ResolveDisputeDeps, "db">,
  args: {
    adminId: string;
    dispute: LoadedDispute;
    notes: string | null;
    recordingCompleteAtResolution: boolean;
  },
): Promise<ServiceResult<{ id: string }, ResolveDisputeErrorCode>> {
  const applied = await deps.db.$transaction(async (tx) => {
    const updated = await tx.dispute.updateMany({
      where: {
        id: args.dispute.id,
        status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
      },
      data: {
        status: DisputeStatus.IN_REVIEW,
        resolution: null,
        resolvedAt: null,
        resolutionNotes: args.notes,
        recordingCompleteAtResolution: args.recordingCompleteAtResolution,
      },
    });

    if (updated.count === 0) {
      return false;
    }

    await writeAdminAudit(tx, args.adminId, {
      action: AdminAuditAction.DISPUTE_MORE_EVIDENCE,
      disputeId: args.dispute.id,
      before: { status: args.dispute.status },
      after: { status: DisputeStatus.IN_REVIEW, resolution: null },
      metadata: {
        resolutionAmountCents: 0,
        recordingComplete: args.recordingCompleteAtResolution,
        justificationPresent: args.notes !== null,
      },
    });

    return true;
  });

  if (!applied) {
    return svcFail("CONFLICT", "Dispute is no longer open");
  }

  return svcOk({ id: args.dispute.id });
}

/**
 * Runs only after the F3 service confirmed the money moved. A retry re-enters
 * an idempotent F3 call and then completes this same finalization, so a crash
 * between Stripe and the database never duplicates money nor leaves the
 * dispute open.
 */
async function finalize(
  deps: Pick<ResolveDisputeDeps, "db">,
  args: {
    adminId: string;
    dispute: LoadedDispute;
    resolution: DisputeResolution;
    resolutionAmountCents: number;
    orderStatus: OrderStatus;
    notes: string | null;
    recordingCompleteAtResolution: boolean;
  },
): Promise<ServiceResult<{ id: string }, ResolveDisputeErrorCode>> {
  const resolvedAt = new Date();

  const finalized = await deps.db.$transaction(async (tx) => {
    const updated = await tx.dispute.updateMany({
      where: {
        id: args.dispute.id,
        status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
      },
      data: {
        status: DisputeStatus.RESOLVED,
        resolution: args.resolution,
        resolutionAmountCents: args.resolutionAmountCents,
        resolutionNotes: args.notes,
        recordingCompleteAtResolution: args.recordingCompleteAtResolution,
        resolvedAt,
      },
    });

    if (updated.count === 0) {
      return false;
    }

    await tx.order.update({
      where: { id: args.dispute.orderId },
      data: { status: args.orderStatus },
    });

    // D10-4: a FULL_REFUND cancels the order, so its held units go back —
    // unless the goods were already handed over (F10 review L1: they left
    // with the customer; restoring would add phantom units). Any other
    // resolution makes the sale final: the hold is consumed.
    if (args.orderStatus === OrderStatus.CANCELLED) {
      const handedOver = await tx.orderEvent.findFirst({
        where: {
          orderId: args.dispute.orderId,
          type: { in: [OrderEventType.DELIVERED, OrderEventType.PICKED_UP] },
        },
        select: { id: true },
      });

      if (handedOver) {
        await consumeHeldStock(tx, { orderId: args.dispute.orderId });
      } else {
        await restoreHeldStock(tx, {
          orderId: args.dispute.orderId,
          actorUserId: args.adminId,
          reason: "DISPUTE_FULL_REFUND",
        });
      }
    } else {
      await consumeHeldStock(tx, { orderId: args.dispute.orderId });
    }

    await writeAdminAudit(tx, args.adminId, {
      action: AdminAuditAction.DISPUTE_RESOLVED,
      disputeId: args.dispute.id,
      before: { status: args.dispute.status },
      after: {
        status: DisputeStatus.RESOLVED,
        resolution: args.resolution,
      },
      metadata: {
        resolutionAmountCents: args.resolutionAmountCents,
        recordingComplete: args.recordingCompleteAtResolution,
        justificationPresent: args.notes !== null,
      },
    });

    return true;
  });

  if (!finalized) {
    return svcFail("CONFLICT", "Dispute was resolved concurrently");
  }

  return svcOk({ id: args.dispute.id });
}
