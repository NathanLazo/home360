import "server-only";

import { decode, encode, type JWT } from "next-auth/jwt";

import type { UserRole } from "@generated/prisma";
import { env } from "~/env";

/**
 * Salt for mobile bearer tokens. Deliberately different from the NextAuth
 * session cookie salt so a mobile token can never be replayed as a cookie
 * session (and vice versa) even though both share `AUTH_SECRET`.
 */
export const MOBILE_TOKEN_SALT = "home360.mobile-token";

const MOBILE_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type MobileTokenUser = {
  id: string;
  role: UserRole;
};

function requireAuthSecret(): string {
  const secret = env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is required to issue mobile tokens");
  }

  return secret;
}

/**
 * Issues an encrypted JWT with the same payload shape as the NextAuth session
 * token (`JWT` from `src/server/auth/types.ts`), valid for 30 days.
 */
export async function issueMobileToken(user: MobileTokenUser): Promise<string> {
  const token: JWT = {
    sub: user.id,
    id: user.id,
    role: user.role,
    authIssuedAtMs: Date.now(),
    authInvalidated: false,
  };

  return encode({
    token,
    secret: requireAuthSecret(),
    salt: MOBILE_TOKEN_SALT,
    maxAge: MOBILE_TOKEN_MAX_AGE_SECONDS,
  });
}

/**
 * Verifies a mobile bearer token. Returns the decoded payload, or `null` when
 * the token is missing required claims, expired, or otherwise invalid.
 */
export async function verifyMobileToken(token: string): Promise<JWT | null> {
  try {
    const payload = await decode<JWT>({
      token,
      secret: requireAuthSecret(),
      salt: MOBILE_TOKEN_SALT,
    });

    if (
      !payload?.sub ||
      typeof payload.id !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.authIssuedAtMs !== "number"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
