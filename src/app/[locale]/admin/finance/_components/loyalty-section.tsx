"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ADMIN_TABLE_CARD_CLASS } from "../../_components/admin-surface";
import { ClearFiltersButton } from "../../_components/clear-filters-button";
import { SectionHeading } from "../../_components/section-heading";
import {
  TableSkeleton,
  type TableSkeletonColumn,
} from "../../_components/table-skeleton";
import { CancelLoyaltyBonusDialog } from "./cancel-loyalty-bonus-dialog";
import { loyaltyBonusStatusSchema } from "./finance.schema";
import type {
  LoyaltyBonusRow,
  LoyaltyBonusStatusFilter,
} from "./finance.types";
import { LoyaltyBonusesTable } from "./loyalty-bonuses-table";
import { PayLoyaltyBonusDialog } from "./pay-loyalty-bonus-dialog";
import { useLoyaltyMutations } from "./use-withdrawal-mutations";
import { LoyaltyBonusStatus } from "@generated/prisma";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

const ALL_STATUSES = "all";

const SKELETON_COLUMNS: TableSkeletonColumn[] = [
  { width: "w-36" },
  { width: "w-20", align: "end" },
  { width: "w-40" },
  { width: "w-20" },
  { width: "w-16" },
  { width: "w-36", align: "end" },
];

/**
 * Loyalty-bonus settlement queue: cursor-paginated ("Cargar más"), filterable
 * by status and defaulting to PENDING — the bonuses that still need action.
 */
export function LoyaltySection() {
  const t = useTranslations("admin.finance.loyalty");
  const statusT = useTranslations("admin.loyaltyBonusStatus");
  const [status, setStatus] = useState<LoyaltyBonusStatusFilter>(
    LoyaltyBonusStatus.PENDING,
  );
  const [payingBonus, setPayingBonus] = useState<LoyaltyBonusRow | null>(null);
  const [cancellingBonus, setCancellingBonus] =
    useState<LoyaltyBonusRow | null>(null);
  const mutations = useLoyaltyMutations({
    onSettled: () => {
      setPayingBonus(null);
      setCancellingBonus(null);
    },
  });

  const query = api.admin.finance.listLoyaltyBonuses.useInfiniteQuery(
    status ? { status } : {},
    {
      getNextPageParam: (lastPage) => lastPage.result?.nextCursor ?? undefined,
    },
  );

  const pages = query.data?.pages ?? [];
  const errorCode =
    pages.find((page) => page.error !== null)?.error ??
    (query.error ? toErrorCode(query.error) : null);
  const bonuses = pages.flatMap((page) => page.result?.items ?? []);

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="admin-finance-loyalty"
    >
      <SectionHeading
        id="admin-finance-loyalty"
        title={t("title")}
        description={t("description")}
        action={
          <Select
            value={status ?? ALL_STATUSES}
            onValueChange={(value) =>
              setStatus(
                value === ALL_STATUSES
                  ? null
                  : loyaltyBonusStatusSchema.parse(value),
              )
            }
          >
            <SelectTrigger
              className="min-h-11 w-44 sm:min-h-10"
              aria-label={t("statusFilterLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>{t("allStatuses")}</SelectItem>
              {Object.values(LoyaltyBonusStatus).map((option) => (
                <SelectItem key={option} value={option}>
                  {statusT(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {query.isPending ? (
        <TableSkeleton
          columns={SKELETON_COLUMNS}
          rows={4}
          label={t("loading")}
        />
      ) : null}

      {!query.isPending && errorCode !== null ? (
        <SectionError
          title={t("errorTitle")}
          code={errorCode}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {!query.isPending && errorCode === null ? (
        <Card className={ADMIN_TABLE_CARD_CLASS}>
          <CardContent className="px-0">
            <LoyaltyBonusesTable
              bonuses={bonuses}
              onPay={setPayingBonus}
              onCancel={setCancellingBonus}
              emptyAction={
                status !== null ? (
                  <ClearFiltersButton onClear={() => setStatus(null)} />
                ) : undefined
              }
            />
          </CardContent>
          {query.hasNextPage ? (
            <div className="flex justify-center border-t p-4">
              <Button
                type="button"
                variant="outline"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? (
                  <LoaderCircleIcon
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : null}
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <PayLoyaltyBonusDialog
        bonus={payingBonus}
        loading={mutations.pending}
        onOpenChange={(open) => {
          if (!open) {
            setPayingBonus(null);
          }
        }}
        onConfirm={mutations.pay}
      />

      <CancelLoyaltyBonusDialog
        bonus={cancellingBonus}
        loading={mutations.pending}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingBonus(null);
          }
        }}
        onConfirm={mutations.cancel}
      />
    </section>
  );
}
