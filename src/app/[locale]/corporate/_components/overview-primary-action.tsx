"use client";

import { ReceiptTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

/** The overview's key action: the consolidated order history. */
export function OverviewPrimaryAction() {
  const t = useTranslations("corporate.home");

  return (
    <Button asChild metal="live" className="min-h-11 sm:min-h-10">
      <Link href="/corporate/orders">
        <ReceiptTextIcon aria-hidden="true" />
        {t("primaryAction")}
      </Link>
    </Button>
  );
}
