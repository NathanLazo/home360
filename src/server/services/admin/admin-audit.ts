import "server-only";

import {
  AdminAuditAction,
  AdminAuditTarget,
  type BusinessStatus,
  type DisputeResolution,
  type DisputeStatus,
  type LoyaltyPayoutMethod,
  type Prisma,
  type WithdrawalStatus,
} from "@generated/prisma";

/**
 * Append-only administrative trail.
 *
 * Allowed payload: internal ids, states, boolean presence flags, amounts in
 * cents, percentages, bonus method, previous/next settings fields and the D6
 * recording state.
 *
 * Forbidden payload: free text from reasons or justifications, emails, document,
 * evidence or recording URLs, dispute arguments, bank details, Stripe ids or
 * tokens, stacks and provider messages. `reasonPresent` exists precisely so the
 * trail can say a reason was given without storing it.
 */
export type AdminAuditEvent =
  | {
      action:
        | typeof AdminAuditAction.BUSINESS_APPROVED
        | typeof AdminAuditAction.BUSINESS_REJECTED
        | typeof AdminAuditAction.BUSINESS_SUSPENDED
        | typeof AdminAuditAction.BUSINESS_REACTIVATED;
      businessId: string;
      before: { status: BusinessStatus };
      after: { status: BusinessStatus };
      metadata?: { planCode?: string; reasonPresent?: boolean };
    }
  | {
      action:
        | typeof AdminAuditAction.DISPUTE_RESOLVED
        | typeof AdminAuditAction.DISPUTE_MORE_EVIDENCE;
      disputeId: string;
      before: { status: DisputeStatus };
      after: { status: DisputeStatus; resolution: DisputeResolution | null };
      metadata: {
        resolutionAmountCents: number;
        recordingComplete: boolean;
        justificationPresent: boolean;
      };
    }
  | {
      action:
        | typeof AdminAuditAction.WITHDRAWAL_APPROVED
        | typeof AdminAuditAction.WITHDRAWAL_REJECTED;
      withdrawalId: string;
      before: { status: WithdrawalStatus };
      after: { status: WithdrawalStatus };
      metadata: { amountCents: number; reasonPresent: boolean };
    }
  | {
      action: typeof AdminAuditAction.SETTINGS_UPDATED;
      before: Record<string, number | string | boolean>;
      after: Record<string, number | string | boolean>;
    }
  | {
      action:
        | typeof AdminAuditAction.LOYALTY_BONUS_PAID
        | typeof AdminAuditAction.LOYALTY_BONUS_CANCELLED;
      bonusId: string;
      metadata: {
        amountCents: number;
        method: LoyaltyPayoutMethod | null;
        reasonPresent: boolean;
      };
    };

type AuditRow = {
  targetType: AdminAuditTarget;
  targetId: string;
  before: Prisma.InputJsonValue | undefined;
  after: Prisma.InputJsonValue | undefined;
  metadata: Prisma.InputJsonValue | undefined;
};

/** Exhaustive by construction: a new action fails to compile until mapped. */
function toRow(event: AdminAuditEvent): AuditRow {
  switch (event.action) {
    case AdminAuditAction.BUSINESS_APPROVED:
    case AdminAuditAction.BUSINESS_REJECTED:
    case AdminAuditAction.BUSINESS_SUSPENDED:
    case AdminAuditAction.BUSINESS_REACTIVATED:
      return {
        targetType: AdminAuditTarget.BUSINESS,
        targetId: event.businessId,
        before: event.before,
        after: event.after,
        metadata: event.metadata,
      };
    case AdminAuditAction.DISPUTE_RESOLVED:
    case AdminAuditAction.DISPUTE_MORE_EVIDENCE:
      return {
        targetType: AdminAuditTarget.DISPUTE,
        targetId: event.disputeId,
        before: event.before,
        after: { ...event.after, resolution: event.after.resolution ?? null },
        metadata: event.metadata,
      };
    case AdminAuditAction.WITHDRAWAL_APPROVED:
    case AdminAuditAction.WITHDRAWAL_REJECTED:
      return {
        targetType: AdminAuditTarget.WITHDRAWAL,
        targetId: event.withdrawalId,
        before: event.before,
        after: event.after,
        metadata: event.metadata,
      };
    case AdminAuditAction.SETTINGS_UPDATED:
      return {
        targetType: AdminAuditTarget.PLATFORM_SETTINGS,
        // The singleton always has id 1.
        targetId: "1",
        before: event.before,
        after: event.after,
        metadata: undefined,
      };
    case AdminAuditAction.LOYALTY_BONUS_PAID:
    case AdminAuditAction.LOYALTY_BONUS_CANCELLED:
      return {
        targetType: AdminAuditTarget.LOYALTY_BONUS,
        targetId: event.bonusId,
        before: undefined,
        after: undefined,
        metadata: { ...event.metadata, method: event.metadata.method ?? null },
      };
  }
}

/**
 * Writes the trail inside the very transaction that confirms the domain
 * change, so a recorded action always corresponds to an applied one.
 */
export async function writeAdminAudit(
  tx: Pick<Prisma.TransactionClient, "adminAuditLog">,
  adminId: string,
  event: AdminAuditEvent,
): Promise<void> {
  const row = toRow(event);

  await tx.adminAuditLog.create({
    data: {
      adminId,
      action: event.action,
      targetType: row.targetType,
      targetId: row.targetId,
      ...(row.before === undefined ? {} : { before: row.before }),
      ...(row.after === undefined ? {} : { after: row.after }),
      ...(row.metadata === undefined ? {} : { metadata: row.metadata }),
    },
  });
}
