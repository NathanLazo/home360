import type { UserRole } from "@generated/prisma";
import type { Session } from "next-auth";

import { redirect } from "~/i18n/navigation";
import { homeForRole } from "~/lib/auth/role-home";
import { auth } from "~/server/auth";

export async function requireRole(
  allowedRole: UserRole,
  locale: string,
  callbackPath: string,
): Promise<Session["user"]> {
  const session = await auth();

  if (!session || session.user.authInvalidated) {
    return redirect({
      href: `/login?callbackUrl=${encodeURIComponent(callbackPath)}`,
      locale,
    });
  }

  if (session.user.role !== allowedRole) {
    return redirect({ href: homeForRole(session.user.role), locale });
  }

  return session.user;
}
