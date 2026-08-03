import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { edgeAuthConfig } from "./edge-config";
import { env } from "~/env";
import { loginSchema } from "~/schemas/auth/login.schema";
import { db } from "~/server/db";
import { verifyPasswordOrDummy } from "~/server/services/auth/password";
import {
  clientIpFromHeaders,
  emailRateLimitIdentifier,
  ipRateLimitIdentifier,
  releaseRateLimitAttempts,
  reserveRateLimitAttempts,
} from "~/server/services/auth/rate-limit";

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
      authorize: async (credentials, request) => {
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
            identifier: ipRateLimitIdentifier(
              clientIpFromHeaders(request.headers),
            ),
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
      },
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
        select: { sessionsValidFrom: true },
      });
      token.authInvalidated =
        !storedUser ||
        storedUser.sessionsValidFrom.getTime() > token.authIssuedAtMs;
      return token;
    },
    signIn: ({ account, profile }) => {
      if (account?.provider !== "google") {
        return true;
      }

      return hasVerifiedGoogleEmail(profile);
    },
  },
} satisfies NextAuthConfig;
