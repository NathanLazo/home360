"use client";

import {
  MapPinIcon,
  RadiusIcon,
  ShoppingBagIcon,
  UserRoundIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { BranchCardActions } from "./branch-card-actions";
import { BranchCoverageMap } from "./branch-coverage-map";
import type { BranchListItem } from "./branch.types";
import { StatusBadge } from "~/components/status-badge";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

export function BranchCard({
  branch,
  statusPending,
  deletePending,
  onEdit,
  onStatus,
  onDelete,
}: {
  branch: BranchListItem;
  statusPending: boolean;
  deletePending: boolean;
  onEdit: () => void;
  onStatus: (status: "ACTIVE" | "PAUSED") => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.branches");
  return (
    <Card className="hover:border-hairline-strong/60 gap-0 overflow-hidden py-0 transition-[border-color,box-shadow] duration-150 ease-out hover:shadow-md motion-reduce:transition-none">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-display-sm truncate">{branch.name}</h2>
            <StatusBadge
              status={branch.status}
              variantMap={{ ACTIVE: "success", PAUSED: "warning" }}
              label={t(`status.${branch.status.toLowerCase()}`)}
            />
          </div>
          <p className="text-muted-foreground text-copy-sm flex items-start gap-2">
            <MapPinIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{branch.address}</span>
          </p>
        </div>
        <BranchCardActions
          branch={branch}
          statusPending={statusPending}
          deletePending={deletePending}
          onEdit={onEdit}
          onStatus={onStatus}
          onDelete={onDelete}
        />
      </CardHeader>
      <BranchCoverageMap radiusKm={branch.coverageRadiusKm} />
      <CardContent className="text-copy-sm grid gap-3 px-5 py-4">
        <p className="flex items-center gap-2">
          <UserRoundIcon
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
          <span className="text-muted-foreground">{t("card.manager")}</span>
          <span className="ml-auto text-right font-medium">
            {branch.managerName ?? t("card.unassigned")}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <ShoppingBagIcon
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
          <span className="text-muted-foreground">
            {t("card.monthlyOrders")}
          </span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {branch.monthlyOrders}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <RadiusIcon
            aria-hidden="true"
            className="text-muted-foreground size-4"
          />
          <span className="text-muted-foreground">{t("card.coverage")}</span>
          <span className="ml-auto font-mono font-medium tabular-nums">
            {t("card.kilometers", { count: branch.coverageRadiusKm })}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
