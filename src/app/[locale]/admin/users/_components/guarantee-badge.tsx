"use client";

import { useTranslations } from "next-intl";

import type { BusinessRow } from "./users.types";
import { Badge } from "~/components/ui/badge";

export function GuaranteeBadge({
  guaranteeType,
}: {
  guaranteeType: BusinessRow["guaranteeType"];
}) {
  const t = useTranslations("admin.guaranteeTypes");

  return (
    <Badge variant="outline" className="font-normal">
      {t(guaranteeType)}
    </Badge>
  );
}
