import "server-only";

import { Prisma, type PrismaClient } from "@generated/prisma";

import type { CorporateTierChangeRequestInput } from "~/server/api/schemas/corporate";
import { fail, ok, type TrpcResponse } from "~/server/api/contract";

function isPendingKeyConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Opens a tier-change request for the admin to review (F7-03 resolves it with
 * `updateTerms`). It never touches tier, commission or fee by itself: tiers
 * are negotiated and some are CUSTOM.
 *
 * Idempotency: `pendingKey` holds the account id while the request is
 * PENDING and is unique, so two concurrent calls can never leave two pending
 * rows. Repeating the same requested tier returns the existing request;
 * asking for a different one while another is pending is a `CONFLICT`.
 */
export async function requestCorporateTierChange(
  db: PrismaClient,
  corporateAccountId: string,
  input: CorporateTierChangeRequestInput,
): Promise<TrpcResponse<{ id: string }>> {
  try {
    const request = await db.corporateTierChangeRequest.create({
      data: {
        corporateAccountId,
        requestedTier: input.tier,
        notes: input.notes,
        pendingKey: corporateAccountId,
      },
      select: { id: true },
    });

    return ok(request, "Tier change requested", 201);
  } catch (error) {
    if (!isPendingKeyConflict(error)) {
      throw error;
    }
  }

  const pending = await db.corporateTierChangeRequest.findUnique({
    where: { pendingKey: corporateAccountId },
    select: { id: true, requestedTier: true },
  });

  // The pending row vanished between the failed insert and this read (the
  // admin just resolved it). Asking the caller to retry is honest: the state
  // it conflicted with no longer exists.
  if (!pending) {
    return fail("CONFLICT", 409, "Tier request conflicted; try again");
  }

  if (pending.requestedTier === input.tier) {
    return ok({ id: pending.id }, "Tier change already requested");
  }

  return fail(
    "CONFLICT",
    409,
    "Another tier change request is already pending",
  );
}

/**
 * Withdraws the account's own PENDING tier-change request (workstream D).
 * Pending requests carry no review yet, so withdrawing simply removes the
 * row; the unique `pendingKey` frees up for a new request.
 */
export async function cancelCorporateTierChangeRequest(
  db: PrismaClient,
  corporateAccountId: string,
): Promise<TrpcResponse<{ id: string }>> {
  const pending = await db.corporateTierChangeRequest.findFirst({
    where: { corporateAccountId, status: "PENDING" },
    select: { id: true },
  });

  if (!pending) {
    return fail("NOT_FOUND", 404, "No pending tier change request");
  }

  const removed = await db.corporateTierChangeRequest.deleteMany({
    where: { id: pending.id, corporateAccountId, status: "PENDING" },
  });

  if (removed.count === 0) {
    return fail("CONFLICT", 409, "Tier change request was already reviewed");
  }

  return ok({ id: pending.id }, "Tier change request withdrawn");
}
