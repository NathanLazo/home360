"use client";

import { LoaderCircleIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ActivateCorporateDialog } from "./activate-corporate-dialog";
import { CorporateAccountsTable } from "./corporate-accounts-table";
import { CorporateDetailActions } from "./corporate-detail-actions";
import { CorporateDetailSheet } from "./corporate-detail-sheet";
import { CorporateFilters } from "./corporate-filters";
import type { CorporateRowAction } from "./corporate-row-actions";
import {
  CorporateTermsForm,
  type CorporateTermsTarget,
} from "./corporate-terms-form";
import { CorporateTierRequests } from "./corporate-tier-requests";
import { corporateTabSchema } from "./corporate.schema";
import type {
  CorporateAccountDetail,
  CorporateActionTarget,
} from "./corporate.types";
import { CreateCorporateDialog } from "./create-corporate-dialog";
import { ReactivateCorporateDialog } from "./reactivate-corporate-dialog";
import { ReconcileBillingDialog } from "./reconcile-billing-dialog";
import { SuspendCorporateDialog } from "./suspend-corporate-dialog";
import { useCorporateMutations } from "./use-corporate-mutations";
import { useCorporateQuery } from "./use-corporate-query";
import { useCorporateUrlState } from "./use-corporate-url-state";
import { useDebouncedValue } from "./use-debounced-value";
import { PageHeader } from "~/components/page-header";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

const SEARCH_DEBOUNCE_MS = 300;

type PendingCorporateAction = {
  target: CorporateActionTarget;
  action: Exclude<CorporateRowAction, "editTerms">;
};

export function CorporateView() {
  const t = useTranslations("admin.corporate");
  const urlState = useCorporateUrlState();
  const [search, setSearch] = useState(urlState.search);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // Filters live in the URL (ticket F7-04): a refresh keeps tab, tier and the
  // typed search. Only the debounced value is written to avoid history spam.
  useEffect(() => {
    if (debouncedSearch !== urlState.search) {
      urlState.setSearch(debouncedSearch);
    }
    // urlState changes identity on every params change; the sync only depends
    // on the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const query = useCorporateQuery({
    tab: urlState.tab,
    tier: urlState.tier,
    search: debouncedSearch,
  });
  const counts = query.state.status === "success" ? query.state.counts : null;

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<PendingCorporateAction | null>(null);
  const [termsTarget, setTermsTarget] = useState<CorporateTermsTarget | null>(
    null,
  );

  const mutations = useCorporateMutations({
    onSettledSuccess: () => {
      setCreateOpen(false);
      setPendingAction(null);
      setTermsTarget(null);
    },
  });

  const raiseAction = (
    target: CorporateActionTarget,
    action: CorporateRowAction,
  ) => {
    if (action === "editTerms") {
      setTermsTarget({ accountId: target.id });
      return;
    }

    setPendingAction({ target, action });
  };

  const detailTarget = (detail: CorporateAccountDetail): CorporateActionTarget => ({
    id: detail.id,
    name: detail.name,
    tier: detail.tier,
    status: detail.status,
    commissionPct: detail.commissionPct,
    monthlyFeeCents: detail.monthlyFeeCents,
  });

  const createButton = (
    <Button
      type="button"
      className="min-h-11 sm:min-h-10"
      onClick={() => setCreateOpen(true)}
    >
      <PlusIcon aria-hidden="true" />
      {t("create.button")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={createButton}
      />

      <Tabs
        value={urlState.tab}
        onValueChange={(value) =>
          urlState.setTab(corporateTabSchema.parse(value))
        }
      >
        {/* Five status tabs with counts overflow a 375 px viewport; the list
            scrolls on its own instead of widening the page. */}
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {corporateTabSchema.options.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {counts
                ? t(`tabs.${tab}WithCount`, { count: counts[tab] })
                : t(`tabs.${tab}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <CorporateFilters
        search={search}
        onSearchChange={setSearch}
        tier={urlState.tier}
        onTierChange={urlState.setTier}
      />

      {query.state.status === "pending" ? (
        <div className="flex flex-col gap-3" aria-busy="true" role="status">
          <span className="sr-only">{t("loading")}</span>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-lg" />
          ))}
        </div>
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
            <CorporateAccountsTable
              accounts={query.state.items}
              onOpenAccount={urlState.openAccount}
              onAction={(row, action) => raiseAction(row, action)}
              emptyAction={createButton}
            />
          </CardContent>
          {query.hasMore ? (
            <div className="flex justify-center border-t p-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 sm:min-h-10"
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

      <CorporateDetailSheet
        accountId={urlState.accountId}
        onClose={urlState.closeAccount}
        requestsSlot={(detail) => (
          <CorporateTierRequests
            accountId={detail.id}
            requests={detail.tierChangeRequests}
            onApprove={(request) =>
              setTermsTarget({
                accountId: detail.id,
                request: {
                  id: request.id,
                  requestedTier: request.requestedTier,
                },
              })
            }
            rejectPending={mutations.rejectTierChange.pending}
            onReject={mutations.rejectTierChange.run}
          />
        )}
        actionsSlot={(detail) => (
          <CorporateDetailActions
            status={detail.status}
            onAction={(action) => raiseAction(detailTarget(detail), action)}
          />
        )}
      />

      <CreateCorporateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        loading={mutations.create.pending}
        onSubmit={mutations.create.run}
      />

      <CorporateTermsForm
        target={termsTarget}
        onOpenChange={(open) => {
          if (!open) {
            setTermsTarget(null);
          }
        }}
        loading={mutations.updateTerms.pending}
        onSubmit={mutations.updateTerms.run}
      />

      <ActivateCorporateDialog
        target={pendingAction?.action === "activate" ? pendingAction.target : null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        loading={mutations.activate.pending}
        onConfirm={mutations.activate.run}
      />

      <SuspendCorporateDialog
        target={pendingAction?.action === "suspend" ? pendingAction.target : null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        loading={mutations.suspend.pending}
        onConfirm={mutations.suspend.run}
      />

      <ReactivateCorporateDialog
        target={
          pendingAction?.action === "reactivate" ? pendingAction.target : null
        }
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        loading={mutations.reactivate.pending}
        onConfirm={mutations.reactivate.run}
      />

      <ReconcileBillingDialog
        target={
          pendingAction?.action === "reconcileBilling"
            ? pendingAction.target
            : null
        }
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        loading={mutations.reconcileBilling.pending}
        onConfirm={mutations.reconcileBilling.run}
      />
    </div>
  );
}
