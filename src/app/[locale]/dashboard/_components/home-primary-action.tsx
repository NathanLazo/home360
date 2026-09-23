"use client";

import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

/**
 * The home's key action: charging a customer through a protected payment
 * link. Opens the create dialog on the payments screen (`?create=link`).
 */
export function HomePrimaryAction() {
  const t = useTranslations("dashboard.home");

  return (
    <Button asChild metal="bend" className="min-h-11 sm:min-h-10">
      <Link href="/dashboard/payments?create=link">
        <LinkIcon aria-hidden="true" />
        {t("primaryAction")}
      </Link>
    </Button>
  );
}
