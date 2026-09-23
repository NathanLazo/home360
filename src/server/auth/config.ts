import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { edgeAuthConfig } from "./edge-config";
import { env } from "~/env";
import { db } from "~/server/db";
import { verifyCredentials } from "~/server/services/auth/verify-credentials";

async function isSuspendedEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) {
    return false;
  }

  const storedUser = await db.user.findUnique({
    where: { email },
    select: { suspendedAt: true },
  });

  return storedUser?.suspendedAt != null;
}

function hasVerifiedGoogleEmail(profile: unknown): boolean {
  return (
    typeof profile === "object" &&
    profile !== null &&
    "email_verified" in profile &&
    profile.email_verified === true
  );
}

export const authConfig = {
  ...edgeAuthConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials, request) =>
        verifyCredentials(db, credentials, request.headers),
    }),
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    ...edgeAuthConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = user.role;
        token.authIssuedAtMs = Date.now();
        token.authInvalidated = false;
        return token;
      }

      if (!token.sub || token.authIssuedAtMs === undefined) {
        token.authInvalidated = true;
        return token;
      }

      const storedUser = await db.user.findUnique({
        where: { id: token.sub },
        select: { sessionsValidFrom: true, suspendedAt: true },
      });
      token.authInvalidated =
        // A missing user also fails the suspension check (undefined !== null).
        storedUser?.suspendedAt !== null ||
        storedUser.sessionsValidFrom.getTime() > token.authIssuedAtMs;
      return token;
    },
    signIn: async ({ account, profile, user }) => {
      if (account?.provider !== "google") {
        return true;
      }

      if (!hasVerifiedGoogleEmail(profile)) {
        return false;
      }

      // A suspended account (W10 moderation) is denied like any other
      // rejected Google sign-in (AccessDenied → /login).
      return !(await isSuspendedEmail(user.email));
    },
  },
} satisfies NextAuthConfig;
