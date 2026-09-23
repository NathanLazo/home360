import type { NextAuthConfig } from "next-auth";

import "./types";

/**
 * Mirrors `WEB_SESSION_MAX_AGE_SECONDS` (idle timeout of the `Session` row);
 * kept literal here because this file must stay edge-safe (no Prisma).
 */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const edgeAuthConfig = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: "/login", error: "/login" },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = user.role;
        token.authIssuedAtMs = Date.now();
        token.authInvalidated = false;
      }

      return token;
    },
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.id,
        role: token.role,
        authInvalidated: token.authInvalidated ?? true,
        impersonator: token.impersonator ?? null,
      },
    }),
  },
} satisfies NextAuthConfig;
