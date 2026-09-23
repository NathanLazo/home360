"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { AnimatedTabsList } from "../../_components/animated-tabs-list";
import { ClearFiltersButton } from "../../_components/clear-filters-button";
import { BusinessDetailActions } from "./business-detail-actions";
import { BusinessDetailSheet } from "./business-detail-sheet";
import {
  BusinessModerationDialogs,
  type PendingModeration,
} from "./business-moderation-dialogs";
import { BusinessesTable } from "./businesses-table";
import { CustomersTable } from "./customers-table";
import { useCsvExport, useUsersQuery } from "./use-users-query";
import { useUserMutations } from "./use-user-mutations";
import { useDebouncedValue } from "./use-debounced-value";
import { useUsersUrlState } from "./use-users-url-state";
import { UsersFilters } from "./users-filters";
import { UsersTableSkeleton } from "./users-table-skeleton";
import { USERS_CSV_ROW_CAP, usersTabSchema } from "./users.schema";
import { WorkersTable } from "./workers-table";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Tabs } from "~/components/ui/tabs";

const SEARCH_DEBOUNCE_MS = 300;

export function UsersView() {
  const t = useTranslations("admin.users");
  const errorsT = useTranslations("errors");
  const urlState = useUsersUrlState();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const query = useUsersQuery({
    tab: urlState.tab,
    search: debouncedSearch,
    status: urlState.status,
  });
  const csv = useCsvExport(urlState.tab);
  const counts = query.state.status === "success" ? query.state.counts : null;
  const [pendingModeration, setPendingModeration] =
    useState<PendingModeration | null>(null);
  const filtersActive =
    debouncedSearch.trim().length > 0 || urlState.status !== undefined;
  const emptyAction = filtersActive ? (
    <ClearFiltersButton
      onClear={() => {
        setSearch("");
        urlState.setStatus(undefined);
      }}
    />
  ) : undefined;
  const mutations = useUserMutations({
    onSettledSuccess: () => setPendingModeration(null),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Tabs
        value={urlState.tab}
        onValueChange={(value) => urlState.setTab(usersTabSchema.parse(value))}
      >
        <AnimatedTabsList
          value={urlState.tab}
          className="max-w-full justify-start overflow-x-auto"
          items={usersTabSchema.options.map((tab) => ({
            value: tab,
            label: counts
              ? t(`tabs.${tab}WithCount`, { count: counts[tab] })
              : t(`tabs.${tab}`),
          }))}
        />
      </Tabs>

      <UsersFilters
        tab={urlState.tab}
        search={search}
        onSearchChange={setSearch}
        status={urlState.status}
        onStatusChange={urlState.setStatus}
        onExport={csv.exportCsv}
        exporting={csv.exporting}
      />

      {csv.truncated ? (
        <Alert>
          <AlertDescription>
            {t("csvTruncated", { cap: USERS_CSV_ROW_CAP })}
          </AlertDescription>
        </Alert>
      ) : null}

      {csv.errorCode ? (
        <Alert variant="destructive">
          <AlertDescription>{errorsT(csv.errorCode)}</AlertDescription>
        </Alert>
      ) : null}

      {query.state.status === "pending" ? (
        <UsersTableSkeleton tab={urlState.tab} label={t("loading")} />
      ) : null}

      {query.state.status === "error" ? (
        <SectionError
          title={t("errorTitle")}
          code={query.state.code}
          onRetry={query.refetch}
        />
      ) : null}

      {query.state.status === "success" ? (
        <Card className="overflow-hidden py-0">
          <CardContent className="px-0">
            {query.state.page.tab === "businesses" ? (
              <BusinessesTable
                businesses={query.state.page.items}
                onOpenBusiness={urlState.openBusiness}
                onAction={(businessId, action) =>
                  setPendingModeration({ businessId, action })
                }
                emptyAction={emptyAction}
              />
            ) : null}
            {query.state.page.tab === "customers" ? (
              <CustomersTable
                customers={query.state.page.items}
                emptyAction={emptyAction}
              />
            ) : null}
            {query.state.page.tab === "workers" ? (
              <WorkersTable
                workers={query.state.page.items}
                emptyAction={emptyAction}
              />
            ) : null}
          </CardContent>
          {query.hasMore ? (
            <div className="flex justify-center border-t p-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
                disabled={query.loadingMore}
                onClick={query.loadMore}
              >
                {query.loadingMore ? (
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

      <BusinessDetailSheet
        businessId={urlState.businessId}
        onClose={urlState.closeBusiness}
        actionsSlot={(detail) => (
          <BusinessDetailActions
            detail={detail}
            onAction={(action) =>
              setPendingModeration({ businessId: detail.id, action })
            }
          />
        )}
      />

      <BusinessModerationDialogs
        pending={pendingModeration}
        onClose={() => setPendingModeration(null)}
        mutations={mutations}
      />
    </div>
  );
}
