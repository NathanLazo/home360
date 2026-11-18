import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ResetPasswordForm } from "./_components/reset-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { routing } from "~/i18n/routing";
import { BrandMark } from "~/components/brand/brand-mark";

type ResetPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({
  params,
  searchParams,
}: ResetPasswordPageProps) {
  const [{ locale }, { token }] = await Promise.all([params, searchParams]);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.resetPassword" });

  return (
    <main className="bg-canvas flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="bg-canvas-soft w-full max-w-md rounded-2xl py-8 shadow-none">
        <CardHeader className="text-center">
          <BrandMark size={48} className="mx-auto mb-2" />
          <CardTitle>
            <h1 className="text-display-md text-balance">{t("title")}</h1>
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token ?? null} />
        </CardContent>
      </Card>
    </main>
  );
}
