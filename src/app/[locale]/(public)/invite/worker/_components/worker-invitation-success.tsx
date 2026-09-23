"use client";

import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

/** The worker operates from the mobile app; the web only hosts the login. */
export function WorkerInvitationSuccess() {
  const t = useTranslations("auth.inviteWorker");

  return (
    <div className="flex flex-col gap-4" role="status">
      <Button asChild variant="outline" className="min-h-11 w-full">
        <Link href="/login">{t("backToLogin")}</Link>
      </Button>
    </div>
  );
}
