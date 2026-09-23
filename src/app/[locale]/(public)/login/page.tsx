import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GoogleSignInButton } from "./_components/google-sign-in-button";
import { LoginForm } from "./_components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { Link } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const [{ locale }, { callbackUrl, error }] = await Promise.all([
    params,
    searchParams,
  ]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.login" });
  const oauthError =
    error === undefined
      ? undefined
      : error === "OAuthAccountNotLinked"
        ? t("oauthAccountNotLinked")
        : t("oauthFailed");
  const postLoginPath =
    locale === routing.defaultLocale ? "/post-login" : `/${locale}/post-login`;

  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="bg-canvas-soft w-full max-w-md rounded-lg py-8 shadow-none">
        <CardHeader className="text-center">
          <div
            aria-hidden="true"
            className="bg-ink text-on-ink text-display-sm mx-auto mb-2 flex size-10 items-center justify-center rounded-md"
          >
            {t("logoMark")}
          </div>
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
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">
              {t("separator")}
            </span>
            <Separator className="flex-1" />
          </div>
          <GoogleSignInButton
            callbackUrl={callbackUrl}
            postLoginPath={postLoginPath}
          />
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
