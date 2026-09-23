"use client";

import { useFormatter, useTranslations } from "next-intl";

import { PRESS_SURFACE_CLASS } from "../../_components/admin-motion";
import {
  ADMIN_LINK_CARD_ACTIVE_CLASS,
  ADMIN_LINK_CARD_CLASS,
  ADMIN_TONE_CLASS,
} from "../../_components/admin-surface";
import type { DisputeListItem as DisputeListItemType } from "./disputes.types";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

type Tone = "urgent" | "review" | "resolved";

const toneClasses: Record<Tone, string> = {
  urgent: ADMIN_TONE_CLASS.error,
  review: ADMIN_TONE_CLASS.warning,
  resolved: ADMIN_TONE_CLASS.neutral,
};

function toTone(dispute: DisputeListItemType): Tone {
  if (dispute.status === "RESOLVED") {
    return "resolved";
  }

  return dispute.urgency === "URGENT" ? "urgent" : "review";
}

export function DisputeListItem({
  dispute,
  active,
  now,
  onSelect,
}: {
  dispute: DisputeListItemType;
  active: boolean;
  now: Date;
  onSelect: () => void;
}) {
  const t = useTranslations("admin.disputes");
  const toneT = useTranslations("admin.disputes.tone");
  const formatter = useFormatter();
  const tone = toTone(dispute);

  return (
    <button
      type="button"
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
      className={cn(
        "focus-visible:ring-ring focus-visible:ring-offset-background flex w-full flex-col gap-2 p-4 text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        PRESS_SURFACE_CLASS,
        active ? ADMIN_LINK_CARD_ACTIVE_CLASS : ADMIN_LINK_CARD_CLASS,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0 truncate font-medium">{dispute.title}</span>
        <Badge variant="outline" className={cn("shrink-0", toneClasses[tone])}>
          {toneT(tone)}
        </Badge>
      </div>
      <span className="text-muted-foreground truncate text-sm">
        {t("parties", {
          business: dispute.businessName,
          customer: dispute.customerName ?? t("unknownParty"),
        })}
      </span>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          #{dispute.orderFolio}
        </span>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {formatter.number(dispute.amountCents / 100, {
            style: "currency",
            currency: "MXN",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <time
        dateTime={dispute.createdAt.toISOString()}
        className="text-muted-foreground text-xs"
        suppressHydrationWarning
      >
        {formatter.relativeTime(dispute.createdAt, now)}
      </time>
    </button>
  );
}
