"use client";

import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

export function WorkerInvitationInvalid() {
  const t = useTranslations("auth.inviteWorker");

  return (
    <div className="flex flex-col gap-4">
      <p role="alert" className="text-foreground text-copy text-pretty">
        {t("invalidToken")}
      </p>
      <Button asChild variant="outline" className="min-h-11 w-full">
        <Link href="/login">{t("backToLogin")}</Link>
      </Button>
    </div>
  );
}
