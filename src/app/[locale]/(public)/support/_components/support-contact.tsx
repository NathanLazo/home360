import { Mail } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "~/components/ui/button";

const SUPPORT_EMAIL = "support@home360.mx";

/** Support inbox card: the address as verifiable data (mono) plus a mailto CTA. */
export async function SupportContact() {
  const t = await getTranslations("legal");

  return (
    <div className="bg-canvas-soft flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-copy text-foreground">
        {t("contactLine")}
        <span className="font-mono">{SUPPORT_EMAIL}</span>
      </p>
      <Button asChild>
        <a href={`mailto:${SUPPORT_EMAIL}`}>
          <Mail aria-hidden="true" />
          {t("support.emailCta")}
        </a>
      </Button>
    </div>
  );
}
