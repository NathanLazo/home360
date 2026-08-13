import "server-only";

import type { PrismaClient, UserRole } from "../../../../generated/prisma";
import { loginSchema } from "~/schemas/auth/login.schema";
import { verifyPasswordOrDummy } from "~/server/services/auth/password";
import {
  clientIpFromHeaders,
  emailRateLimitIdentifier,
  ipRateLimitIdentifier,
  releaseRateLimitAttempts,
  reserveRateLimitAttempts,
} from "~/server/services/auth/rate-limit";

export type VerifiedCredentialsUser = {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: UserRole;
};

/**
 * Single source of truth for email/password verification. Consumed by the
 * NextAuth Credentials `authorize` callback and by the mobile login endpoint.
 *
 * Returns `null` for every failure (invalid input, rate limited, unknown email
 * or wrong password) so callers cannot leak which case happened.
 */
export async function verifyCredentials(
  db: PrismaClient,
  credentials: unknown,
  headers: Headers,
): Promise<VerifiedCredentialsUser | null> {
  const parsed = loginSchema.safeParse(credentials);

  if (!parsed.success) {
    return null;
  }

  const reservation = await reserveRateLimitAttempts(db, [
    {
      action: "login",
      identifier: emailRateLimitIdentifier(parsed.data.email),
      max: 10,
      windowMinutes: 15,
    },
    {
      action: "login",
      identifier: ipRateLimitIdentifier(clientIpFromHeaders(headers)),
      max: 30,
      windowMinutes: 15,
    },
  ]);

  if (!reservation.allowed) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      passwordHash: true,
    },
  });

  const isValid = await verifyPasswordOrDummy(
    parsed.data.password,
    user?.passwordHash,
  );

  if (!user || !isValid) {
    return null;
  }

  await releaseRateLimitAttempts(db, reservation.attemptIds);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role: user.role,
  };
}
