import "server-only";

import { createHash } from "node:crypto";

import type {
  PrismaClient,
  SessionRevocationReason,
  UserRole,
} from "@generated/prisma";

/**
 * Single active web session per user (pattern ported from prohats-quality).
 *
 * The NextAuth cookie stays an encrypted JWT, but it carries a random `sid`
 * whose SHA-256 is the key of a `Session` row. Every server-side `auth()`
 * resolves that row, so a session can be revoked instantly (sign-out, login on
 * another computer, password change, suspension) instead of living until the
 * JWT expires. Only the hash is stored: a database leak never yields a usable
 * session id, and the id alone is useless without the `AUTH_SECRET`-encrypted
 * cookie that carries it.
 */

/** Idle timeout: the session slides while the user keeps using it. */
export const WEB_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const WEB_SESSION_MAX_AGE_MS = WEB_SESSION_MAX_AGE_SECONDS * 1000;
const EXPIRY_TOUCH_INTERVAL_MS = 60 * 60 * 1000;
const ACTIVITY_TOUCH_INTERVAL_MS = 60 * 1000;
const USER_AGENT_MAX_LENGTH = 512;
const IP_MAX_LENGTH = 64;

export type WebSessionRequestMetadata = {
  deviceId: string | null;
  userAgent: string | null;
  ip: string | null;
};

export type WebSessionIdentity = {
  id: string;
  role: UserRole;
  name: string | null;
  email: string | null;
  image: string | null;
};

export type VerifiedWebSession = {
  /** Who the request acts as: the owner, or the impersonated user. */
  user: WebSessionIdentity;
  /** The ADMIN behind an active impersonation, `null` otherwise. */
  impersonator: { id: string; name: string | null } | null;
};

/** Roles an ADMIN may impersonate (read-only) to see their panels. */
export const IMPERSONATABLE_ROLES = ["BUSINESS", "CORPORATE"] as const;

function isImpersonatableRole(role: UserRole): boolean {
  return IMPERSONATABLE_ROLES.some((allowed) => allowed === role);
}

const identitySelect = {
  id: true,
  role: true,
  name: true,
  email: true,
  image: true,
} as const;

/**
 * Thrown when a login without the "replace" intent finds an active session on
 * another computer. Raised under the per-user lock, so it also covers two
 * logins racing each other.
 */
export class ActiveWebSessionConflictError extends Error {
  constructor() {
    super("Another active web session exists for this user");
    this.name = "ActiveWebSessionConflictError";
  }
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export function normalizeRequestMetadata(input: {
  deviceId: string | null;
  userAgent: string | null;
  ip: string | null;
}): WebSessionRequestMetadata {
  return {
    deviceId: input.deviceId,
    userAgent: input.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    ip: input.ip?.slice(0, IP_MAX_LENGTH) ?? null,
  };
}

function activeSessionsWhere(userId: string, now: Date) {
  return { userId, revokedAt: null, expires: { gt: now } };
}

/**
 * Registers the session created by a successful sign-in. Runs in a
 * transaction that first bumps `User.sessionLockVersion`, which row-locks the
 * user and serializes concurrent logins. Sessions on the same computer are
 * always replaced; sessions on other computers are replaced only with the
 * explicit "replace" intent, otherwise the login fails with
 * `ActiveWebSessionConflictError`.
 */
export async function createWebSession(
  db: PrismaClient,
  input: {
    sessionId: string;
    userId: string;
    replaceOtherDevices: boolean;
    metadata: WebSessionRequestMetadata;
  },
): Promise<void> {
  const now = new Date();
  const { metadata } = input;

  await db.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: input.userId },
      data: { sessionLockVersion: { increment: 1 } },
      select: { id: true },
    });

    const activeSessions = await transaction.session.findMany({
      where: activeSessionsWhere(input.userId, now),
      select: { id: true, deviceId: true },
    });
    const otherDeviceSessions = activeSessions.filter(
      (session) =>
        metadata.deviceId === null || session.deviceId !== metadata.deviceId,
    );

    if (otherDeviceSessions.length > 0 && !input.replaceOtherDevices) {
      throw new ActiveWebSessionConflictError();
    }

    if (activeSessions.length > 0) {
      await transaction.session.updateMany({
        where: { id: { in: activeSessions.map((session) => session.id) } },
        data: { revokedAt: now, revocationReason: "REPLACED_BY_NEW_LOGIN" },
      });
    }

    await transaction.session.create({
      data: {
        sessionToken: hashSessionId(input.sessionId),
        userId: input.userId,
        expires: new Date(now.getTime() + WEB_SESSION_MAX_AGE_MS),
        deviceId: metadata.deviceId,
        userAgent: metadata.userAgent,
        initialIp: metadata.ip,
        lastIp: metadata.ip,
        lastSeenAt: now,
      },
    });
  });
}

async function revokeById(
  db: PrismaClient,
  id: string,
  reason: SessionRevocationReason,
): Promise<void> {
  await db.session.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date(), revocationReason: reason },
  });
}

/**
 * Server-side check behind every `auth()`. Returns the fresh identity for a
 * live session, or `null` when the session must end. Lazily records why a
 * session ended (expired, credentials rotated, suspended, superseded) and
 * slides the idle timeout with throttled writes.
 *
 * Impersonation is resolved here, from the database, on every request: the
 * cookie never decides who the request acts as. An impersonation that
 * expired, whose owner is no longer ADMIN or whose target is no longer an
 * impersonatable role is cleared and the session falls back to its owner.
 */
export async function verifyWebSession(
  db: PrismaClient,
  input: {
    sessionId: string;
    userId: string;
    metadata: WebSessionRequestMetadata;
  },
): Promise<VerifiedWebSession | null> {
  const now = new Date();
  const session = await db.session.findUnique({
    where: { sessionToken: hashSessionId(input.sessionId) },
    select: {
      id: true,
      userId: true,
      expires: true,
      revokedAt: true,
      lastSeenAt: true,
      lastIp: true,
      createdAt: true,
      impersonationExpiresAt: true,
      impersonatedUser: { select: identitySelect },
      user: {
        select: {
          ...identitySelect,
          sessionsValidFrom: true,
          suspendedAt: true,
        },
      },
    },
  });

  if (!session || session.revokedAt || session.userId !== input.userId) {
    return null;
  }

  if (session.user.suspendedAt !== null) {
    await revokeById(db, session.id, "SUSPENDED");
    return null;
  }

  // Password change/reset bumps `sessionsValidFrom`.
  if (session.user.sessionsValidFrom > session.createdAt) {
    await revokeById(db, session.id, "CREDENTIALS_ROTATED");
    return null;
  }

  if (session.expires <= now) {
    await revokeById(db, session.id, "EXPIRED");
    return null;
  }

  // Defense in depth: a newer live session always wins, even if a revocation
  // write was ever lost.
  const newerSession = await db.session.findFirst({
    where: {
      ...activeSessionsWhere(session.userId, now),
      id: { not: session.id },
      createdAt: { gte: session.createdAt },
    },
    select: { id: true },
  });

  if (newerSession) {
    await revokeById(db, session.id, "REPLACED_BY_NEW_LOGIN");
    return null;
  }

  const nextExpires = new Date(now.getTime() + WEB_SESSION_MAX_AGE_MS);
  const shouldSlideExpiry =
    nextExpires.getTime() - session.expires.getTime() >=
    EXPIRY_TOUCH_INTERVAL_MS;
  const ip = input.metadata.ip;
  const shouldTouchActivity =
    now.getTime() - session.lastSeenAt.getTime() >=
      ACTIVITY_TOUCH_INTERVAL_MS ||
    (ip !== null && ip !== session.lastIp);

  if (shouldSlideExpiry || shouldTouchActivity) {
    await db.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: {
        ...(shouldSlideExpiry ? { expires: nextExpires } : {}),
        ...(shouldTouchActivity
          ? { lastSeenAt: now, ...(ip !== null ? { lastIp: ip } : {}) }
          : {}),
      },
    });
  }

  const owner: WebSessionIdentity = {
    id: session.user.id,
    role: session.user.role,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  };
  const target = session.impersonatedUser;

  if (target === null) {
    return { user: owner, impersonator: null };
  }

  const impersonationValid =
    owner.role === "ADMIN" &&
    isImpersonatableRole(target.role) &&
    session.impersonationExpiresAt !== null &&
    session.impersonationExpiresAt > now;

  if (!impersonationValid) {
    await clearImpersonation(db, session.id);
    return { user: owner, impersonator: null };
  }

  return {
    user: target,
    impersonator: { id: owner.id, name: owner.name },
  };
}

async function clearImpersonation(db: PrismaClient, id: string): Promise<void> {
  await db.session.updateMany({
    where: { id, impersonatedUserId: { not: null } },
    data: { impersonatedUserId: null, impersonationExpiresAt: null },
  });
}

export async function revokeWebSession(
  db: PrismaClient,
  sessionId: string,
  reason: SessionRevocationReason,
): Promise<void> {
  await db.session.updateMany({
    where: { sessionToken: hashSessionId(sessionId), revokedAt: null },
    data: { revokedAt: new Date(), revocationReason: reason },
  });
}
