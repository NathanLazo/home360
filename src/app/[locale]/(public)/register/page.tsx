import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { RegisterForm } from "./_components/register-form";
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

type RegisterPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth.register" });

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
        <CardContent>
          <RegisterForm />
        </CardContent>
        <CardFooter className="text-muted-foreground text-copy-sm justify-center gap-1">
          <span>{t("haveAccount")}</span>
          <Link
            href="/login"
            className="text-link-deep font-medium underline-offset-4 hover:underline"
          >
            {t("loginCta")}
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
