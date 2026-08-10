"use client";

import { ArrowLeftIcon, ScaleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { DisputeAiSummary } from "./dispute-ai-summary";
import { DisputeArguments } from "./dispute-arguments";
import { DisputeEvidenceGrid } from "./dispute-evidence-grid";
import { DisputeRecordingPlayer } from "./dispute-recording-player";
import { DisputeResolutionActions } from "./dispute-resolution-actions";
import { ResolveDisputeDialog } from "./resolve-dispute-dialog";
import { useDisputeMutations } from "./use-dispute-mutations";
import type { DisputeDetail as DisputeDetailType } from "./disputes.types";
import type { DisputeResolution } from "../../../../../../generated/prisma";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

function PaymentSummary({ dispute }: { dispute: DisputeDetailType }) {
  const t = useTranslations("admin.disputes.payment");
  const paymentStatusT = useTranslations("admin.paymentStatus");
  const formatter = useFormatter();
  const payment = dispute.payment;

  if (!payment) {
    return (
      <p className="text-muted-foreground text-sm">{t("noPayment")}</p>
    );
  }

  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <Card>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{t("escrow")}</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {currency(payment.amountCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{t("commission")}</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {currency(payment.commissionCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{t("refunded")}</dt>
            <dd className="font-mono font-semibold tabular-nums">
              {currency(payment.refundedCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{t("status")}</dt>
            <dd className="font-medium">{paymentStatusT(payment.status)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

export function DisputeDetail({
  disputeId,
  onBack,
}: {
  disputeId: string | null;
  onBack: () => void;
}) {
  const t = useTranslations("admin.disputes.detail");
  const [resolution, setResolution] = useState<DisputeResolution | null>(null);
  const mutations = useDisputeMutations({
    onResolved: () => setResolution(null),
  });

  const query = api.admin.disputes.getById.useQuery(
    { disputeId: disputeId ?? "" },
    { enabled: disputeId !== null },
  );
  const state = unwrapEnvelope(query);

  if (disputeId === null) {
    return (
      <EmptyState
        icon={ScaleIcon}
        title={t("noSelectionTitle")}
        description={t("noSelectionDescription")}
      />
    );
  }

  if (state.status === "pending") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <SectionError
        title={t("errorTitle")}
        code={state.code}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const dispute = state.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 transition-transform duration-150 ease-out active:scale-[0.96] xl:hidden"
          aria-label={t("back")}
          onClick={onBack}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">
            {dispute.title}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t("subtitle", {
              folio: dispute.order.folio,
              business: dispute.business.name,
            })}
          </p>
        </div>
      </div>

      <DisputeRecordingPlayer
        recordingUrl={dispute.recordingUrl}
        recordingComplete={dispute.recordingComplete}
      />

      <DisputeAiSummary summary={dispute.aiSummary} />

      <PaymentSummary dispute={dispute} />

      <DisputeArguments
        customerArgument={dispute.customerArgument}
        businessArgument={dispute.businessArgument}
      />

      <DisputeEvidenceGrid urls={dispute.evidenceUrls} />

      {dispute.resolutionNotes ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t("resolutionNotes")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {dispute.resolutionNotes}
          </p>
        </section>
      ) : null}

      <DisputeResolutionActions dispute={dispute} onSelect={setResolution} />

      <ResolveDisputeDialog
        dispute={dispute}
        resolution={resolution}
        loading={mutations.pending}
        onOpenChange={(open) => {
          if (!open) {
            setResolution(null);
          }
        }}
        onConfirm={mutations.resolve}
      />
    </div>
  );
}
