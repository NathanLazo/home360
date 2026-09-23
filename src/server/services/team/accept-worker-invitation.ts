import "server-only";

import { Prisma, UserRole, type PrismaClient } from "@generated/prisma";
import type { AcceptWorkerInvitationInput } from "~/schemas/auth/worker-invitation.schema";
import type { AuthErrorCode } from "~/schemas/auth/auth-errors";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";
import { hashPassword } from "~/server/services/auth/password";
import { hashInvitationToken } from "~/server/services/team/worker-invitation-token";

export type WorkerInvitationPreview = {
  workerName: string;
  businessName: string;
  email: string;
};

function liveInvitationWhere(token: string, now: Date) {
  return {
    invitationTokenHash: hashInvitationToken(token),
    invitationStatus: "PENDING",
    invitationExpiresAt: { gt: now },
    invitedEmail: { not: null },
    userId: null,
  } satisfies Prisma.WorkerWhereInput;
}

class InvitationConsumedError extends Error {}

/**
 * Public preview of a live invitation (who invites whom). A wrong, expired or
 * used token answers the same INVALID_TOKEN, revealing nothing else.
 */
export async function getWorkerInvitationPreview(
  db: PrismaClient,
  token: string,
): Promise<TrpcResponse<WorkerInvitationPreview, AuthErrorCode>> {
  const worker = await db.worker.findFirst({
    where: liveInvitationWhere(token, new Date()),
    select: {
      fullName: true,
      invitedEmail: true,
      business: { select: { name: true } },
    },
  });

  if (!worker?.invitedEmail) {
    return fail("INVALID_TOKEN", 400, "Invitation is invalid or expired");
  }

  return ok(
    {
      workerName: worker.fullName,
      businessName: worker.business.name,
      email: worker.invitedEmail,
    },
    "Invitation loaded",
  );
}

/**
 * Accepts a worker invitation (workstream D): creates the WORKER user with
 * the invited email and the worker's own password, links `Worker.userId` and
 * marks the invitation ACCEPTED, burning the token — all in one transaction
 * with a conditional claim so a token can never be used twice. An email that
 * already belongs to another account answers EMAIL_TAKEN (roles are single).
 */
export async function acceptWorkerInvitation(
  db: PrismaClient,
  input: AcceptWorkerInvitationInput,
): Promise<TrpcResponse<{ userId: string; email: string }, AuthErrorCode>> {
  const now = new Date();
  const passwordHash = await hashPassword(input.password);

  try {
    const accepted = await db.$transaction(async (tx) => {
      const worker = await tx.worker.findFirst({
        where: liveInvitationWhere(input.token, now),
        select: { id: true, invitedEmail: true },
      });

      if (!worker?.invitedEmail) {
        return null;
      }

      const user = await tx.user.create({
        data: {
          email: worker.invitedEmail,
          name: input.name,
          role: UserRole.WORKER,
          locale: input.locale,
          passwordHash,
          emailVerified: now,
        },
        select: { id: true, email: true },
      });
      const claimed = await tx.worker.updateMany({
        where: { id: worker.id, ...liveInvitationWhere(input.token, now) },
        data: {
          userId: user.id,
          invitationStatus: "ACCEPTED",
          invitationTokenHash: null,
          invitationExpiresAt: null,
        },
      });

      if (claimed.count === 0) {
        throw new InvitationConsumedError();
      }

      return { userId: user.id, email: worker.invitedEmail };
    });

    if (!accepted) {
      return fail("INVALID_TOKEN", 400, "Invitation is invalid or expired");
    }

    return ok(accepted, "Invitation accepted", 201);
  } catch (error) {
    if (error instanceof InvitationConsumedError) {
      return fail("INVALID_TOKEN", 400, "Invitation is invalid or expired");
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return fail("EMAIL_TAKEN", 409, "Email already registered");
    }

    throw error;
  }
}
