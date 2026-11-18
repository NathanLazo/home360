import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { LoginForm } from "./_components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Link } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";
import {
  ACTIVE_SESSION_EXISTS_CODE,
  SESSION_ENDED_ERROR,
} from "~/lib/auth/session-errors";
import { BrandMark } from "~/components/brand/brand-mark";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    code?: string;
  }>;
};

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const [{ locale }, { callbackUrl, error, code }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.login" });
  const activeSessionConflict =
    error === "CredentialsSignin" && code === ACTIVE_SESSION_EXISTS_CODE;
  const oauthError =
    error === undefined || activeSessionConflict
      ? undefined
      : error === SESSION_ENDED_ERROR
        ? t("sessionEnded")
        : error === "OAuthAccountNotLinked"
          ? t("oauthAccountNotLinked")
          : t("oauthFailed");

  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="bg-canvas-soft w-full max-w-md rounded-2xl py-8 shadow-none">
        <CardHeader className="text-center">
          <BrandMark size={48} className="mx-auto mb-2" />
          <CardTitle>
            <h1 className="text-display-md text-balance">{t("title")}</h1>
          </CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {oauthError ? (
            <p role="alert" className="text-error-deep text-copy-sm">
              {oauthError}
            </p>
          ) : null}
          <LoginForm callbackUrl={callbackUrl} />
        </CardContent>
        <CardFooter className="text-muted-foreground text-copy-sm justify-center gap-1">
          <span>{t("noAccount")}</span>
          <Link
            href="/register"
            className="text-link-deep font-medium underline-offset-4 hover:underline"
          >
            {t("registerCta")}
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
