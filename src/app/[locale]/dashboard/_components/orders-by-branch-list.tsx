"use client";

import { Building2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { EmptyState } from "~/components/empty-state";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";

export type OrdersByBranchListProps = {
  branchId?: string;
};

export function OrdersByBranchList({ branchId }: OrdersByBranchListProps) {
  const t = useTranslations("dashboard.home");
  const errors = useTranslations("errors");
  const formatter = useFormatter();
  const input = branchId ? { branchId } : {};
  const query = api.dashboard.getOrdersByBranch.useQuery(input);
  const response = query.data;

  if (query.isPending) {
    return (
      <Card aria-busy="true">
        <CardHeader>
          <div className="bg-accent h-5 w-44 animate-pulse rounded motion-reduce:animate-none" />
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div className="bg-accent h-4 animate-pulse rounded motion-reduce:animate-none" />
              <div className="bg-accent h-2 animate-pulse rounded-full motion-reduce:animate-none" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (query.error || !response || response.error || !response.result) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>
            <h2>{t("branchOrdersTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t("queryErrorTitle")}</p>
            <p className="text-muted-foreground text-sm">
              {response?.error
                ? errors(response.error)
                : t("queryErrorDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            onClick={() => void query.refetch()}
          >
            {t("retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const data = response.result;

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t("branchOrdersTitle")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Building2Icon}
            title={t("branchEmptyTitle")}
            description={t("branchEmptyDescription")}
          />
        </CardContent>
      </Card>
    );
  }

  const highestCount = Math.max(...data.map((row) => row.ordersCount), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t("branchOrdersTitle")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-5">
          {data.map((row) => {
            const branchName = row.branchName ?? t("noBranch");
            const width = `${Math.max((row.ordersCount / highestCount) * 100, 4)}%`;

            return (
              <li
                key={row.branchId ?? "unassigned"}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="min-w-0 truncate">{branchName}</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatter.number(row.ordersCount)}
                  </span>
                </div>
                <div
                  className="bg-muted h-2 overflow-hidden rounded-full"
                  role="img"
                  aria-label={t("branchCountLabel", {
                    branch: branchName,
                    count: row.ordersCount,
                  })}
                >
                  <div
                    className="bg-foreground h-full rounded-full"
                    style={{ width }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
