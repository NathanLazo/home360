import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { MobileOnlyRedirect } from "./_components/mobile-only-redirect";
import { redirect } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import { homeForRole, safeCallbackForRole } from "~/lib/auth/role-home";
import { auth } from "~/server/auth";

type PostLoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function PostLoginPage({
  params,
  searchParams,
}: PostLoginPageProps) {
  const [{ locale }, { callbackUrl }, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  if (!session || session.user.authInvalidated) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (session.user.role === "CUSTOMER" || session.user.role === "WORKER")
    return <MobileOnlyRedirect />;
  redirect({
    href:
      safeCallbackForRole(session.user.role, callbackUrl) ??
      homeForRole(session.user.role),
    locale,
  });
}
