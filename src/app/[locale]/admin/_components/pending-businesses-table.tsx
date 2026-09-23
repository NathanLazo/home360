"use client";

import { BuildingIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ADMIN_TABLE_CARD_CLASS } from "./admin-surface";
import type { PendingBusinessRow } from "./overview.types";
import { EmptyState } from "~/components/empty-state";
import { DataTable, type DataTableColumn } from "~/components/data-table";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Link } from "~/i18n/navigation";

/**
 * W9 only routes to the moderation module: approving a business needs the W10
 * plan picker and no module imports another module's private components, so
 * "approve" deep-links straight into the approval dialog.
 */
function businessDetailHref(businessId: string): string {
  return `/admin/users?tab=businesses&business=${businessId}`;
}

function businessApproveHref(businessId: string): string {
  return `${businessDetailHref(businessId)}&action=approve`;
}

export function PendingBusinessesTable({
  businesses,
}: {
  businesses: PendingBusinessRow[];
}) {
  const t = useTranslations("admin.overview");
  const typesT = useTranslations("admin.businessTypes");
  const guaranteeT = useTranslations("admin.guaranteeTypes");

  const columns: Array<DataTableColumn<PendingBusinessRow>> = [
    {
      key: "name",
      header: t("pending.columns.name"),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "type",
      header: t("pending.columns.type"),
      cell: (row) => (
        <Badge variant="outline" className="font-normal">
          {typesT(row.type)}
        </Badge>
      ),
    },
    {
      key: "guarantee",
      header: t("pending.columns.guarantee"),
      cell: (row) => (
        <span className="text-muted-foreground text-copy-sm">
          {guaranteeT(row.guaranteeType)}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("pending.columns.actions")}</span>,
      className: "text-right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={businessApproveHref(row.id)}>
              {t("pending.approve")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={businessDetailHref(row.id)}>{t("pending.review")}</Link>
          </Button>
        </div>
      ),
    },
  ];

  if (businesses.length === 0) {
    return (
      <EmptyState
        icon={BuildingIcon}
        title={t("pending.emptyTitle")}
        description={t("pending.emptyDescription")}
        action={
          <Button asChild variant="outline">
            <Link href="/admin/users">{t("pending.emptyCta")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <Card className={ADMIN_TABLE_CARD_CLASS}>
      <DataTable columns={columns} data={businesses} />
    </Card>
  );
}
