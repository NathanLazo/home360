import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@generated/prisma";
import { getPathname } from "~/i18n/navigation";

/** Invitations are longer-lived than password resets: 7 days. */
export const WORKER_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export const hashInvitationToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export type IssuedWorkerInvitation = { url: string; expiresAt: Date };

/**
 * Issues a fresh single-use invitation token for a worker without an account
 * (marking the invitation PENDING): only the SHA-256 is stored and every
 * re-issue (resend or copied link) replaces the previous hash, so only the
 * latest link works. Returns the public acceptance URL
 * `/{locale}/invite/worker?token=…`, or null when the worker already has an
 * account. The plain token is never logged.
 */
export async function issueWorkerInvitation(
  db: PrismaClient,
  input: { workerId: string; appUrl: string; locale: "es" | "en" },
): Promise<IssuedWorkerInvitation | null> {
  const plainToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + WORKER_INVITATION_TTL_MS);
  const updated = await db.worker.updateMany({
    where: { id: input.workerId, userId: null },
    data: {
      invitationStatus: "PENDING",
      invitationTokenHash: hashInvitationToken(plainToken),
      invitationExpiresAt: expiresAt,
    },
  });

  if (updated.count === 0) {
    return null;
  }

  const pathname = getPathname({
    href: "/invite/worker",
    locale: input.locale,
  });
  const url = new URL(pathname, input.appUrl);
  url.searchParams.set("token", plainToken);

  return { url: url.toString(), expiresAt };
}
