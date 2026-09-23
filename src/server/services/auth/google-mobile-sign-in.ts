import "server-only";

import { Prisma, UserRole, type PrismaClient } from "@generated/prisma";
import type { MobileTokenUser } from "~/server/auth/mobile-token";
import type { VerifiedGoogleIdToken } from "~/server/services/auth/google-id-token";

export type GoogleSignInOutcome =
  | { kind: "SIGNED_IN"; user: MobileTokenUser; created: boolean }
  | { kind: "BLOCKED" };

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Mobile Google sign-in with implicit sign-up (workstream D): a verified
 * Google email without an account becomes a CUSTOMER with an empty
 * `CustomerProfile` (customers are born in the app). Existing accounts keep
 * their role; suspended ones are blocked. Business, worker and corporate
 * accounts are never created here — they come from their own onboarding.
 */
export async function signInWithGoogle(
  db: PrismaClient,
  input: { token: VerifiedGoogleIdToken; locale: "es" | "en" },
): Promise<GoogleSignInOutcome> {
  const existing = await db.user.findUnique({
    where: { email: input.token.email },
    select: { id: true, role: true, suspendedAt: true },
  });

  if (existing) {
    return existing.suspendedAt !== null
      ? { kind: "BLOCKED" }
      : {
          kind: "SIGNED_IN",
          user: { id: existing.id, role: existing.role },
          created: false,
        };
  }

  try {
    const created = await db.user.create({
      data: {
        email: input.token.email,
        name: input.token.name,
        emailVerified: new Date(),
        role: UserRole.CUSTOMER,
        locale: input.locale,
        customerProfile: { create: {} },
      },
      select: { id: true, role: true },
    });

    return { kind: "SIGNED_IN", user: created, created: true };
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    // A concurrent sign-in created the account first: use it.
    const raced = await db.user.findUniqueOrThrow({
      where: { email: input.token.email },
      select: { id: true, role: true, suspendedAt: true },
    });

    return raced.suspendedAt !== null
      ? { kind: "BLOCKED" }
      : {
          kind: "SIGNED_IN",
          user: { id: raced.id, role: raced.role },
          created: false,
        };
  }
}
