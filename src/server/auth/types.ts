import type { DefaultSession } from "next-auth";
import "next-auth/jwt";

import type { UserRole } from "../../../generated/prisma";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: UserRole;
      authInvalidated: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    authIssuedAtMs?: number;
    authInvalidated: boolean;
  }
}
