import "server-only";

import type { PrismaClient } from "@generated/prisma";
import { env } from "~/env";
import type {
  TeamErrorCode,
  WorkerInvitationLinkInput,
} from "~/schemas/team/worker.schema";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { issueWorkerInvitation } from "~/server/services/team/worker-invitation-token";

export type WorkerInvitationLink = { url: string; expiresAt: Date };

/**
 * Shareable acceptance link for a tenant worker without an account, so the
 * owner can hand it over by WhatsApp/SMS when email is not an option. Issuing
 * a link burns any previous one (single live token per worker). Workers
 * without an invited email enter theirs when accepting.
 */
export async function createWorkerInvitationLink(
  db: PrismaClient,
  businessId: string,
  input: WorkerInvitationLinkInput,
): Promise<TrpcResponse<WorkerInvitationLink, TeamErrorCode>> {
  const worker = await db.worker.findFirst({
    where: { id: input.id, businessId },
    select: { id: true, userId: true },
  });

  if (!worker) {
    return fail("NOT_FOUND", 404, "Worker not found");
  }

  if (worker.userId !== null) {
    return fail("CONFLICT", 409, "Worker already has an account");
  }

  const invitation = await issueWorkerInvitation(db, {
    workerId: worker.id,
    appUrl: env.APP_URL,
    locale: input.locale,
  });

  if (!invitation) {
    return fail("CONFLICT", 409, "Worker already has an account");
  }

  return ok(invitation, "Worker invitation link created", 201);
}
