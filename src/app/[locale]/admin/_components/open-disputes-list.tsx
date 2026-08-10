"use client";

import { ChevronRightIcon, ScaleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { OpenDisputeItem } from "./overview.types";
import { useCurrencyFormatter } from "./use-currency-formatter";
import { EmptyState } from "~/components/empty-state";
import { Badge } from "~/components/ui/badge";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const urgencyClasses = {
  URGENT: "border-red-200 bg-red-50 text-red-700",
  NORMAL: "border-amber-200 bg-amber-50 text-amber-800",
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
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {disputes.map((dispute) => (
        <li key={dispute.id}>
          <Link
            href={`/admin/disputes?dispute=${dispute.id}`}
            className="bg-card focus-visible:ring-ring group flex items-center gap-4 rounded-xl border p-4 transition-colors duration-150 ease-out hover:bg-zinc-50 focus-visible:ring-2 focus-visible:outline-none"
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
              <p className="text-muted-foreground truncate text-sm">
                {t("disputes.parties", {
                  business: dispute.businessName,
                  customer: dispute.customerName ?? t("disputes.unknownParty"),
                })}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatter.relativeTime(dispute.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="font-mono text-sm font-semibold">
                {currency(dispute.escrowCents)}
              </span>
              <ChevronRightIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
