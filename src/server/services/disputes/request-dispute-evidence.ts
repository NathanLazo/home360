import "server-only";

import {
  AdminAuditAction,
  DisputeStatus,
  type PrismaClient,
} from "@generated/prisma";

import {
  EVIDENCE_NOTE_MAX_LENGTH,
  EVIDENCE_NOTE_MIN_LENGTH,
} from "~/app/[locale]/admin/disputes/_components/disputes.schema";
import { writeAdminAudit } from "../admin/admin-audit";
import { sendLocalizedPushToUser } from "../push/messages";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type RequestDisputeEvidenceInput = {
  adminId: string;
  disputeId: string;
  note: string;
};

/**
 * W11 "Pedir más evidencia": a non-terminal step that never touches money. It
 * moves the dispute to IN_REVIEW, stores what evidence the admin needs and
 * notifies both parties (customer and business owner) by push. The note is
 * free text, so the audit trail only records that one was given.
 */
export async function requestDisputeEvidence(
  deps: { db: PrismaClient },
  input: RequestDisputeEvidenceInput,
): Promise<
  ServiceResult<{ id: string; notifiedUsers: number }, "VALIDATION_ERROR">
> {
  const note = input.note.trim();

  if (
    note.length < EVIDENCE_NOTE_MIN_LENGTH ||
    note.length > EVIDENCE_NOTE_MAX_LENGTH
  ) {
    return svcFail("VALIDATION_ERROR", "Evidence request note is invalid");
  }

  const dispute = await deps.db.dispute.findUnique({
    where: { id: input.disputeId },
    select: {
      id: true,
      status: true,
      orderId: true,
      business: { select: { ownerId: true } },
      order: { select: { customerId: true } },
    },
  });

  if (!dispute) {
    return svcFail("NOT_FOUND", "Dispute not found");
  }

  if (dispute.status === DisputeStatus.RESOLVED) {
    return svcFail("CONFLICT", "Dispute is already resolved");
  }

  const recipients = [
    ...new Set([dispute.order.customerId, dispute.business.ownerId]),
  ];

  const applied = await deps.db.$transaction(async (tx) => {
    const updated = await tx.dispute.updateMany({
      where: {
        id: dispute.id,
        status: { in: [DisputeStatus.OPEN, DisputeStatus.IN_REVIEW] },
      },
      data: {
        status: DisputeStatus.IN_REVIEW,
        evidenceRequestNote: note,
        evidenceRequestedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return false;
    }

    await writeAdminAudit(tx, input.adminId, {
      action: AdminAuditAction.DISPUTE_EVIDENCE_REQUESTED,
      disputeId: dispute.id,
      before: { status: dispute.status },
      after: { status: DisputeStatus.IN_REVIEW },
      metadata: { notePresent: true, notifiedUsers: recipients.length },
    });

    return true;
  });

  if (!applied) {
    return svcFail("CONFLICT", "Dispute is no longer open");
  }

  // Best-effort delivery after the commit: a push outage never undoes the
  // request, and `sendLocalizedPushToUser` swallows its own failures.
  await Promise.all(
    recipients.map((userId) =>
      sendLocalizedPushToUser(deps.db, userId, {
        message: "disputeEvidenceRequested",
        url: `home360app://orders/${dispute.orderId}`,
      }),
    ),
  );

  return svcOk({ id: dispute.id, notifiedUsers: recipients.length });
}
