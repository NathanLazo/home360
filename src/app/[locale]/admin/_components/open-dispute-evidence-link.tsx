"use client";

import { FileSearchIcon, VideoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { OpenDisputeItem } from "./overview.types";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";

/**
 * W9 quick action: jumps straight to the D6 evidence the verdict depends on.
 * The recording wins over uploaded evidence because an incomplete recording
 * decides the dispute on its own (D6); with neither, nothing is offered.
 */
export function OpenDisputeEvidenceLink({
  dispute,
}: {
  dispute: OpenDisputeItem;
}) {
  const t = useTranslations("admin.overview.disputes");

  if (dispute.hasRecording) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/disputes?dispute=${dispute.id}#recording`}>
          <VideoIcon aria-hidden="true" />
          {t("viewRecording")}
        </Link>
      </Button>
    );
  }

  if (dispute.evidenceCount > 0) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={`/admin/disputes?dispute=${dispute.id}#evidence`}>
          <FileSearchIcon aria-hidden="true" />
          {t("viewEvidence", { count: dispute.evidenceCount })}
        </Link>
      </Button>
    );
  }

  return null;
}
