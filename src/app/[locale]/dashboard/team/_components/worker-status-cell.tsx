"use client";

import { useTranslations } from "next-intl";

import type { WorkerListItem } from "./team.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";

const AVAILABILITY_VARIANTS: Record<
  WorkerListItem["availability"],
  StatusBadgeVariant
> = {
  AVAILABLE: "success",
  ON_SERVICE: "info",
  OFF: "muted",
};

/**
 * Live status (N6): availability reported by the worker app plus today's
 * assigned orders. A worker who has not accepted the invitation has no app
 * session yet, so the status reads as pending instead of a stale default.
 */
export function WorkerStatusCell({ worker }: { worker: WorkerListItem }) {
  const t = useTranslations("dashboard.team");

  if (worker.invitationStatus === "PENDING") {
    return (
      <span className="text-muted-foreground text-copy-sm">
        {t("availability.notConnected")}
      </span>
    );
  }

  return (
    <span className="flex flex-col items-start gap-1">
      <StatusBadge
        status={worker.availability}
        variantMap={AVAILABILITY_VARIANTS}
        label={t(`availability.${worker.availability}`)}
      />
      <span className="text-muted-foreground text-copy-sm tabular-nums">
        {t("availability.todayOrders", { count: worker.todayOrdersCount })}
      </span>
    </span>
  );
}
