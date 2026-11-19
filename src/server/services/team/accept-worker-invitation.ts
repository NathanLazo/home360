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
  /** Null when the owner shared the link without an email: the worker types it. */
  email: string | null;
};

function liveInvitationWhere(token: string, now: Date) {
  return {
    invitationTokenHash: hashInvitationToken(token),
    invitationStatus: "PENDING",
    invitationExpiresAt: { gt: now },
    userId: null,
  } satisfies Prisma.WorkerWhereInput;
}

class InvitationConsumedError extends Error {}
class InvitationEmailMissingError extends Error {}

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

  if (!worker) {
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

      if (!worker) {
        return null;
      }

      // The invited email wins; a hand-shared link takes the worker's own.
      const email = worker.invitedEmail ?? input.email;

      if (!email) {
        throw new InvitationEmailMissingError();
      }

      const user = await tx.user.create({
        data: {
          email,
          name: input.name,
          role: UserRole.WORKER,
          locale: input.locale,
          passwordHash,
          // Only the owner-entered address counts as verified.
          emailVerified: worker.invitedEmail ? now : null,
        },
        select: { id: true, email: true },
      });
      const claimed = await tx.worker.updateMany({
        where: { id: worker.id, ...liveInvitationWhere(input.token, now) },
        data: {
          userId: user.id,
          invitedEmail: email,
          invitationStatus: "ACCEPTED",
          invitationTokenHash: null,
          invitationExpiresAt: null,
        },
      });

      if (claimed.count === 0) {
        throw new InvitationConsumedError();
      }

      return { userId: user.id, email };
    });

    if (!accepted) {
      return fail("INVALID_TOKEN", 400, "Invitation is invalid or expired");
    }

    return ok(accepted, "Invitation accepted", 201);
  } catch (error) {
    if (error instanceof InvitationEmailMissingError) {
      return fail("VALIDATION_ERROR", 400, "Email is required");
    }

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
