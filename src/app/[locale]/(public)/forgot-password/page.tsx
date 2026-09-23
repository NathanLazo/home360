import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ForgotPasswordForm } from "./_components/forgot-password-form";
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

type ForgotPasswordPageProps = { params: Promise<{ locale: string }> };

export default async function ForgotPasswordPage({
  params,
}: ForgotPasswordPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.forgotPassword" });

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
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
        <CardFooter className="justify-center">
          <Link
            href="/login"
            className="text-link-deep text-copy-sm min-h-11 py-3 font-medium underline-offset-4 hover:underline"
          >
            {t("backToLogin")}
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
