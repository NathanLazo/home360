import "server-only";

import {
  AdminAuditAction,
  DocumentStatus,
  type PrismaClient,
} from "@generated/prisma";

import { writeAdminAudit } from "./admin-audit";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

export type ReviewBusinessDocumentDeps = {
  db: PrismaClient;
};

export type ReviewBusinessDocumentInput = {
  documentId: string;
  status: typeof DocumentStatus.APPROVED | typeof DocumentStatus.REJECTED;
  notes?: string;
  adminId: string;
};

/**
 * Records the admin verdict on one KYC document. A verdict can be revised
 * (a document approved by mistake can be rejected later) but never set to
 * the state it already has, so a double click does not rewrite the trail.
 * The notes live on the document; the audit only records they existed.
 */
export async function reviewBusinessDocument(
  deps: ReviewBusinessDocumentDeps,
  input: ReviewBusinessDocumentInput,
): Promise<ServiceResult<{ id: string; businessId: string }, "CONFLICT">> {
  const outcome = await deps.db.$transaction(async (tx) => {
    const document = await tx.businessDocument.findUnique({
      where: { id: input.documentId },
      select: { id: true, businessId: true, status: true },
    });

    if (!document) {
      return { kind: "not_found" } as const;
    }

    const updated = await tx.businessDocument.updateMany({
      where: { id: document.id, status: { not: input.status } },
      data: {
        status: input.status,
        notes: input.notes ?? null,
        reviewedById: input.adminId,
        reviewedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      return { kind: "conflict" } as const;
    }

    await writeAdminAudit(tx, input.adminId, {
      action:
        input.status === DocumentStatus.APPROVED
          ? AdminAuditAction.DOCUMENT_APPROVED
          : AdminAuditAction.DOCUMENT_REJECTED,
      documentId: document.id,
      before: { status: document.status },
      after: { status: input.status },
      metadata: {
        businessId: document.businessId,
        notesPresent: input.notes !== undefined,
      },
    });

    return { kind: "ok", businessId: document.businessId } as const;
  });

  if (outcome.kind === "not_found") {
    return svcFail("NOT_FOUND", "Document not found");
  }

  if (outcome.kind === "conflict") {
    return svcFail("CONFLICT", "Document already has that status");
  }

  return svcOk({ id: input.documentId, businessId: outcome.businessId });
}
