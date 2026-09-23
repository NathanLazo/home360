import { randomUUID } from "node:crypto";

import { PrismaAdapter } from "@auth/prisma-adapter";
import { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { edgeAuthConfig } from "./edge-config";
import { sessionIntentSchema } from "./session-cookies";
import {
  clearSessionIntentCookie,
  readSessionIntentCookie,
  readSessionRequestMetadata,
} from "./session-request";
import { env } from "~/env";
import { ACTIVE_SESSION_EXISTS_CODE } from "~/lib/auth/session-errors";
import { db } from "~/server/db";
import { verifyCredentials } from "~/server/services/auth/verify-credentials";
import {
  ActiveWebSessionConflictError,
  createWebSession,
  revokeWebSession,
  verifyWebSession,
} from "~/server/services/auth/web-session";

/** Surfaces as `code` on `signIn()` results and on the `/login` redirect. */
class ActiveSessionExistsError extends CredentialsSignin {
  code = ACTIVE_SESSION_EXISTS_CODE;
}

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

function readCredentialsIntent(credentials: unknown) {
  const intent =
    typeof credentials === "object" &&
    credentials !== null &&
    "sessionIntent" in credentials
      ? credentials.sessionIntent
      : undefined;
  const parsed = sessionIntentSchema.safeParse(intent);
  return parsed.success ? parsed.data : "keep";
}

export const authConfig = {
  ...edgeAuthConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: { email: {}, password: {}, sessionIntent: {} },
      authorize: async (credentials, request) => {
        const user = await verifyCredentials(db, credentials, request.headers);
        return user
          ? { ...user, sessionIntent: readCredentialsIntent(credentials) }
          : null;
      },
    }),
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    ...edgeAuthConfig.callbacks,
    jwt: async ({ token, user, account }) => {
      // Sign-in: register the single active web session. The conflict check
      // runs under a per-user lock inside `createWebSession`, so two logins
      // racing each other cannot both win.
      if (user) {
        const userId = user.id ?? token.sub;
        if (!userId) {
          return null;
        }

        const sessionId = randomUUID();
        const intent =
          account?.provider === "credentials"
            ? user.sessionIntent
            : await readSessionIntentCookie();

        try {
          await createWebSession(db, {
            sessionId,
            userId,
            replaceOtherDevices: intent === "replace",
            metadata: await readSessionRequestMetadata(),
          });
        } catch (error) {
          if (error instanceof ActiveWebSessionConflictError) {
            throw new ActiveSessionExistsError();
          }
          throw error;
        }
        await clearSessionIntentCookie();

        token.id = userId;
        token.role = user.role;
        token.sid = sessionId;
        token.authIssuedAtMs = Date.now();
        token.authInvalidated = false;
        return token;
      }

      // Tokens without a session id predate the session registry (or were
      // forged without one): end them and force a fresh login.
      if (!token.sub || !token.sid) {
        return null;
      }

      try {
        const verified = await verifyWebSession(db, {
          sessionId: token.sid,
          userId: token.sub,
          metadata: await readSessionRequestMetadata(),
        });

        // `null` makes Auth.js drop the cookie and `auth()` return null.
        if (!verified) {
          return null;
        }

        // The effective identity comes from the database on every request,
        // so starting or ending an impersonation needs no cookie rewrite.
        token.id = verified.user.id;
        token.role = verified.user.role;
        token.name = verified.user.name;
        token.email = verified.user.email;
        token.picture = verified.user.image;
        token.impersonator = verified.impersonator;
        token.authInvalidated = false;
      } catch (error) {
        // Fail closed without logging the user out: a transient database
        // error denies access for this request but keeps the cookie.
        console.error("[auth] web session verification failed", error);
        token.authInvalidated = true;
      }

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
  events: {
    signOut: async (message) => {
      if ("token" in message && message.token?.sid) {
        await revokeWebSession(db, message.token.sid, "SIGNED_OUT");
      }
    },
  },
} satisfies NextAuthConfig;
