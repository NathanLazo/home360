import type { NextAuthConfig } from "next-auth";

import "./types";

export const edgeAuthConfig = {
  session: { strategy: "jwt" },
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
      },
    }),
  },
} satisfies NextAuthConfig;
