import NextAuth from "next-auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

import {
  splitLocaleFromPathname,
  withLocalePrefix,
} from "~/i18n/locale-pathname";
import { routing } from "~/i18n/routing";
import { homeForRole, isRouteOrDescendant } from "~/lib/auth/role-home";
import { edgeAuthConfig } from "~/server/auth/edge-config";

const intlMiddleware = createIntlMiddleware(routing);
const { auth } = NextAuth(edgeAuthConfig);

export default auth((request) => {
  const { locale, pathname } = splitLocaleFromPathname(
    request.nextUrl.pathname,
  );
  const session = request.auth;
  const wantsDashboard = isRouteOrDescendant(pathname, "/dashboard");
  const wantsAdmin = isRouteOrDescendant(pathname, "/admin");
  const wantsProtectedRoute = wantsDashboard || wantsAdmin;

  if (wantsProtectedRoute && !session) {
    const loginUrl = new URL(
      withLocalePrefix(locale, "/login"),
      request.nextUrl,
    );
    loginUrl.searchParams.set(
      "callbackUrl",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(loginUrl);
  }

  if (session && wantsProtectedRoute) {
    const home = homeForRole(session.user.role);
    const isAllowed =
      (wantsDashboard && home === "/dashboard") ||
      (wantsAdmin && home === "/admin");

    if (!isAllowed) {
      return NextResponse.redirect(
        new URL(withLocalePrefix(locale, home), request.nextUrl),
      );
    }
  }

  return intlMiddleware(request);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
