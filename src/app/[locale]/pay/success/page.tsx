import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CheckIcon } from "lucide-react";

import { MetalRing } from "~/components/metal";
import { routing } from "~/i18n/routing";

type PaySuccessPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function PaySuccessPage({ params }: PaySuccessPageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const t = await getTranslations("common.pay.success");

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        {/* The payment is held in escrow: the one moment of the flow that
            earns a material accent. Decorative; the heading carries meaning. */}
        <MetalRing variant="circle" strength={0.7} className="mb-3">
          <span className="bg-background text-foreground flex size-14 items-center justify-center rounded-full">
            <CheckIcon aria-hidden="true" className="size-6" strokeWidth={2} />
          </span>
        </MetalRing>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
    </main>
  );
}
