"use client";

import { ScaleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

type OverviewPrimaryActionProps = {
  /** The beam lights only while there are open disputes waiting on a verdict. */
  urgent: boolean;
};

/** The overview's key action: the dispute queue. */
export function OverviewPrimaryAction({ urgent }: OverviewPrimaryActionProps) {
  const t = useTranslations("admin.overview");

  return (
    <Button
      asChild
      beam
      beamActive={urgent}
    >
      <Link href="/admin/disputes">
        <ScaleIcon aria-hidden="true" />
        {t("primaryAction")}
      </Link>
    </Button>
  );
}
