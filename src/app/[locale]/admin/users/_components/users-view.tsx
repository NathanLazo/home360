"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { AnimatedTabsList } from "../../_components/animated-tabs-list";
import { ADMIN_TABLE_CARD_CLASS } from "../../_components/admin-surface";
import { ClearFiltersButton } from "../../_components/clear-filters-button";
import { useSuccessBeat } from "../../_components/use-success-beat";
import { BusinessDetailActions } from "./business-detail-actions";
import { BusinessDetailSheet } from "./business-detail-sheet";
import {
  BusinessModerationDialogs,
  type PendingModeration,
} from "./business-moderation-dialogs";
import { BusinessesTable } from "./businesses-table";
import { CustomerDetailSheet } from "./customer-detail-sheet";
import { CustomersTable } from "./customers-table";
import {
  UserAccessDialogs,
  type PendingUserAccess,
} from "./user-access-dialogs";
import { useCsvExport, useUsersQuery } from "./use-users-query";
import { useUserAccessMutations } from "./use-user-access-mutations";
import { useUserMutations } from "./use-user-mutations";
import { useDebouncedValue } from "./use-debounced-value";
import { useUsersUrlState } from "./use-users-url-state";
import { UsersFilters } from "./users-filters";
import { toUsersFilters } from "./users-query-filters";
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
  const [search, setSearch] = useState(urlState.search);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // The URL mirrors the debounced search so a refresh or shared link keeps
  // it; only the settled value is written to avoid history spam.
  useEffect(() => {
    if (debouncedSearch !== urlState.search) {
      urlState.setSearch(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the typed value only
  }, [debouncedSearch]);

  // A tab change clears `q` in the URL; the local field follows it.
  useEffect(() => {
    setSearch(urlState.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on tab switch only
  }, [urlState.tab]);

  const filters = useMemo(
    () =>
      toUsersFilters({
        tab: urlState.tab,
        search: debouncedSearch,
        status: urlState.status,
        accessStatus: urlState.accessStatus,
        availability: urlState.availability,
      }),
    [
      urlState.tab,
      debouncedSearch,
      urlState.status,
      urlState.accessStatus,
      urlState.availability,
    ],
  );

  const query = useUsersQuery(filters);
  const csv = useCsvExport(filters);
  const counts = query.state.status === "success" ? query.state.counts : null;
  const [pendingModeration, setPendingModeration] =
    useState<PendingModeration | null>(null);
  const [pendingAccess, setPendingAccess] = useState<PendingUserAccess | null>(
    null,
  );
  const filtersActive = Object.keys(filters).length > 1;
  const emptyAction = filtersActive ? (
    <ClearFiltersButton
      onClear={() => {
        setSearch("");
        urlState.clearFilters();
      }}
    />
  ) : undefined;

  // W9 "approve" deep link: open the approval dialog once, then drop the
  // request from the URL so a refresh does not reopen it.
  const { approveRequested, businessId, clearApproveRequest } = urlState;
  useEffect(() => {
    if (approveRequested && businessId) {
      setPendingModeration({ businessId, action: "approve" });
      clearApproveRequest();
    }
  }, [approveRequested, businessId, clearApproveRequest]);

  const successBeat = useSuccessBeat();
  const mutations = useUserMutations({
    onSettledSuccess: () => {
      // Confirm-dialog actions have no check slot: close immediately.
      if (
        pendingModeration?.action === "reactivate" ||
        pendingModeration?.action === "reopen"
      ) {
        setPendingModeration(null);
        return;
      }

      successBeat.celebrate(() => setPendingModeration(null));
    },
  });
  const accessBeat = useSuccessBeat();
  const accessMutations = useUserAccessMutations({
    onSettledSuccess: () => {
      if (pendingAccess?.action === "reactivate") {
        setPendingAccess(null);
        return;
      }

      accessBeat.celebrate(() => setPendingAccess(null));
    },
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
        accessStatus={urlState.accessStatus}
        onAccessStatusChange={urlState.setAccessStatus}
        availability={urlState.availability}
        onAvailabilityChange={urlState.setAvailability}
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
        <Card className={ADMIN_TABLE_CARD_CLASS}>
          <CardContent className="px-0">
            {query.state.page.tab === "businesses" ? (
              <BusinessesTable
                businesses={query.state.page.items}
                onOpenBusiness={(id) => urlState.openBusiness(id)}
                onReviewDocuments={(id) =>
                  urlState.openBusiness(id, "documents")
                }
                onAction={(id, action) =>
                  setPendingModeration({ businessId: id, action })
                }
                emptyAction={emptyAction}
              />
            ) : null}
            {query.state.page.tab === "customers" ? (
              <CustomersTable
                customers={query.state.page.items}
                onOpenCustomer={urlState.openCustomer}
                onAccessAction={(userId, action) =>
                  setPendingAccess({ userId, action })
                }
                emptyAction={emptyAction}
              />
            ) : null}
            {query.state.page.tab === "workers" ? (
              <WorkersTable
                workers={query.state.page.items}
                onOpenBusiness={(id) => urlState.openBusiness(id)}
                onAccessAction={(userId, action) =>
                  setPendingAccess({ userId, action })
                }
                emptyAction={emptyAction}
              />
            ) : null}
          </CardContent>
          {query.hasMore ? (
            <div className="flex justify-center border-t p-4">
              <Button
                type="button"
                variant="outline"
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
        focusSection={urlState.businessSection}
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

      <CustomerDetailSheet
        customerId={urlState.customerId}
        onClose={urlState.closeCustomer}
        onAccessAction={(userId, action) =>
          setPendingAccess({ userId, action })
        }
      />

      <BusinessModerationDialogs
        pending={pendingModeration}
        onClose={() => setPendingModeration(null)}
        mutations={mutations}
        succeeded={successBeat.succeeded}
      />

      <UserAccessDialogs
        pending={pendingAccess}
        onClose={() => setPendingAccess(null)}
        mutations={accessMutations}
        succeeded={accessBeat.succeeded}
      />
    </div>
  );
}
