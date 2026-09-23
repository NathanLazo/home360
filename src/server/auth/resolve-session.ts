import "server-only";

import type { Session } from "next-auth";

import { auth } from "~/server/auth";
import { verifyMobileToken } from "~/server/auth/mobile-token";
import { db } from "~/server/db";

const BEARER_PREFIX = "Bearer ";

/**
 * Mobile fallback (M0-W2, extracted here for M4-W1): resolves a session from
 * an `Authorization: Bearer` header when the cookie path yielded nothing. The
 * returned object has the exact shape the `session` callback in
 * `edge-config.ts` produces (`user: { id, role, authInvalidated }`), so every
 * guard downstream works unchanged. `authInvalidated` re-reads
 * `User.sessionsValidFrom` against the token's `authIssuedAtMs`, mirroring the
 * `jwt` callback in `config.ts`. An invalid or expired token resolves to
 * `null`; the guards answer with a generic UNAUTHORIZED without leaking the
 * reason.
 */
export async function resolveBearerSession(
  headers: Headers,
): Promise<Session | null> {
  const authorization = headers.get("authorization");

  if (!authorization?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const payload = await verifyMobileToken(
    authorization.slice(BEARER_PREFIX.length),
  );

  if (!payload?.sub || payload.authIssuedAtMs === undefined) {
    return null;
  }

  const storedUser = await db.user.findUnique({
    where: { id: payload.sub },
    select: { sessionsValidFrom: true, suspendedAt: true },
  });

  const authInvalidated =
    // A missing user also fails the suspension check (undefined !== null).
    storedUser?.suspendedAt !== null ||
    storedUser.sessionsValidFrom.getTime() > payload.authIssuedAtMs;

  return {
    user: {
      id: payload.id,
      role: payload.role,
      authInvalidated,
      // Impersonation is a web-only (cookie session) feature.
      impersonator: null,
    },
    expires:
      typeof payload.exp === "number"
        ? new Date(payload.exp * 1000).toISOString()
        : new Date().toISOString(),
  };
}

/**
 * Session from cookie (NextAuth) with Bearer fallback, in that order, so web
 * requests pay zero extra latency. Shared by the tRPC context and the Pusher
 * channel auth endpoint (M4-W1). An invalidated session resolves to `null`.
 */
export async function resolveSession(
  headers: Headers,
): Promise<Session | null> {
  const session = (await auth()) ?? (await resolveBearerSession(headers));

  if (!session?.user || session.user.authInvalidated) {
    return null;
  }

  return session;
}
