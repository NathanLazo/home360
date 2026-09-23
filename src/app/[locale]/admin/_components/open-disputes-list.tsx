"use client";

import { ChevronRightIcon, ScaleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { OpenDisputeEvidenceLink } from "./open-dispute-evidence-link";
import type { OpenDisputeItem } from "./overview.types";
import { PRESS_SURFACE_CLASS } from "./admin-motion";
import { ADMIN_LINK_CARD_CLASS, ADMIN_TONE_CLASS } from "./admin-surface";
import { useCurrencyFormatter } from "./use-currency-formatter";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const urgencyClasses = {
  URGENT: ADMIN_TONE_CLASS.error,
  NORMAL: ADMIN_TONE_CLASS.warning,
} as const;

export function OpenDisputesList({
  disputes,
}: {
  disputes: OpenDisputeItem[];
}) {
  const t = useTranslations("admin.overview");
  const urgencyT = useTranslations("admin.disputeUrgency");
  const formatter = useFormatter();
  const currency = useCurrencyFormatter();

  if (disputes.length === 0) {
    return (
      <EmptyState
        icon={ScaleIcon}
        title={t("disputes.emptyTitle")}
        description={t("disputes.emptyDescription")}
        action={
          <Button asChild variant="outline">
            <Link href="/admin/disputes?status=resolved">
              {t("disputes.emptyCta")}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {disputes.map((dispute) => (
        <li
          key={dispute.id}
          className={cn("flex flex-col", ADMIN_LINK_CARD_CLASS)}
        >
          <Link
            href={`/admin/disputes?dispute=${dispute.id}`}
            className={cn(
              "focus-visible:ring-ring group focus-visible:ring-offset-background flex items-center gap-4 rounded-md p-4 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              PRESS_SURFACE_CLASS,
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(urgencyClasses[dispute.urgency])}
                >
                  {urgencyT(dispute.urgency)}
                </Badge>
                <p className="truncate font-medium">{dispute.title}</p>
              </div>
              <p className="text-muted-foreground text-copy-sm truncate">
                {t("disputes.parties", {
                  business: dispute.businessName,
                  customer: dispute.customerName ?? t("disputes.unknownParty"),
                })}
              </p>
              <time
                dateTime={dispute.createdAt.toISOString()}
                className="text-muted-foreground text-xs"
                suppressHydrationWarning
              >
                {formatter.relativeTime(dispute.createdAt)}
              </time>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-copy-sm font-mono font-semibold tabular-nums">
                {currency(dispute.escrowCents)}
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </div>
          </Link>
          {dispute.hasRecording || dispute.evidenceCount > 0 ? (
            <div className="flex justify-start px-4 pb-4">
              <OpenDisputeEvidenceLink dispute={dispute} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
