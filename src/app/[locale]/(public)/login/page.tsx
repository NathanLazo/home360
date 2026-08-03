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
    <main className="bg-muted flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex size-12 items-center justify-center rounded-xl text-xl font-semibold">
            {t("logoMark")}
          </div>
          <CardTitle>
            <h1 className="text-2xl">{t("title")}</h1>
          </CardTitle>
          <CardDescription>{t("subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {oauthError ? (
            <p role="alert" className="text-destructive text-sm">
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
        <CardFooter className="text-muted-foreground justify-center gap-1 text-sm">
          <span>{t("noAccount")}</span>
          <Link
            href="/register"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            {t("registerCta")}
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
