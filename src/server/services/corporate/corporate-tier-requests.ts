import "server-only";

import {
  Prisma,
  type PrismaClient,
} from "@generated/prisma";

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
