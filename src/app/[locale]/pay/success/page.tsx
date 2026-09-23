import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { MetalRing } from "~/components/metal";
import { SuccessCheck } from "~/components/motion";
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
    <main className="bg-canvas-soft flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        {/* The payment is held in escrow: the one moment of the flow that
            earns a material accent, and the tick draws itself once (static
            under reduced motion). Decorative; the heading carries meaning. */}
        <MetalRing variant="circle" strength={0.7} className="mb-3">
          <span className="bg-canvas text-success-deep flex size-14 items-center justify-center rounded-full">
            <SuccessCheck className="size-6" />
          </span>
        </MetalRing>
        <h1 className="text-display-md text-balance">{t("title")}</h1>
        <p className="text-muted-foreground text-copy text-pretty">
          {t("description")}
        </p>
      </div>
    </main>
  );
}
