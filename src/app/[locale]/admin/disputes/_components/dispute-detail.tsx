"use client";

import { ArrowLeftIcon, ScaleIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import {
  ADMIN_DURATION,
  ADMIN_EASE_OUT,
  ADMIN_SETTLE_PX,
} from "../../_components/admin-motion";
import { CopyIdButton } from "../../_components/copy-id-button";
import { useSuccessBeat } from "../../_components/use-success-beat";
import { DisputeAiSummary } from "./dispute-ai-summary";
import { DisputeArguments } from "./dispute-arguments";
import { DisputeDetailSkeleton } from "./dispute-detail-skeleton";
import { DisputeEvidenceGrid } from "./dispute-evidence-grid";
import { DisputeRecordingPlayer } from "./dispute-recording-player";
import { DisputeResolutionActions } from "./dispute-resolution-actions";
import { RequestEvidenceDialog } from "./request-evidence-dialog";
import { ResolveDisputeDialog } from "./resolve-dispute-dialog";
import { useDisputeMutations } from "./use-dispute-mutations";
import type { DisputeDetail as DisputeDetailType } from "./disputes.types";
import { DisputeResolution } from "@generated/prisma";
import { EmptyState } from "~/components/empty-state";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

function PaymentSummary({ dispute }: { dispute: DisputeDetailType }) {
  const t = useTranslations("admin.disputes.payment");
  const paymentStatusT = useTranslations("admin.paymentStatus");
  const formatter = useFormatter();
  const payment = dispute.payment;

  if (!payment) {
    return (
      <p className="text-muted-foreground text-copy-sm">{t("noPayment")}</p>
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
        <dl className="text-copy-sm grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
              {t("escrow")}
            </dt>
            <dd className="text-copy-sm font-mono font-semibold tabular-nums">
              {currency(payment.amountCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
              {t("commission")}
            </dt>
            <dd className="text-copy-sm font-mono font-semibold tabular-nums">
              {currency(payment.commissionCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
              {t("refunded")}
            </dt>
            <dd className="text-copy-sm font-mono font-semibold tabular-nums">
              {currency(payment.refundedCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
              {t("status")}
            </dt>
            <dd className="text-copy-sm font-medium">
              {paymentStatusT(payment.status)}
            </dd>
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
  const reduceMotion = useReducedMotion();
  const formatter = useFormatter();
  const [resolution, setResolution] = useState<DisputeResolution | null>(null);
  const [requestingEvidence, setRequestingEvidence] = useState(false);
  const successBeat = useSuccessBeat();
  const mutations = useDisputeMutations({
    // The check lands on the confirm button before the dialog closes.
    onResolved: () => successBeat.celebrate(() => setResolution(null)),
    onEvidenceRequested: () => setRequestingEvidence(false),
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
    return <DisputeDetailSkeleton label={t("loading")} />;
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

  // Switching files swaps the whole pane; a short fade (plus a 4 px settle
  // when motion is allowed) keeps the swap from reading as a flash.
  return (
    <motion.div
      key={dispute.id}
      className="flex flex-col gap-6"
      initial={
        reduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              transform: `translateY(${ADMIN_SETTLE_PX}px)`,
            }
      }
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: ADMIN_DURATION.standard, ease: ADMIN_EASE_OUT }}
    >
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 xl:hidden"
          aria-label={t("back")}
          onClick={onBack}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-display-sm text-balance">{dispute.title}</h2>
          <p className="text-muted-foreground text-copy-sm">
            {t("subtitle", {
              folio: dispute.order.folio,
              business: dispute.business.name,
            })}
          </p>
          <CopyIdButton value={dispute.id} className="-ml-2" />
        </div>
      </div>

      <DisputeRecordingPlayer
        recordingUrl={dispute.recordingUrl}
        recordingComplete={dispute.recordingComplete}
        segments={dispute.recordingSegments}
      />

      <DisputeAiSummary
        summary={dispute.aiSummary}
        generatedAt={dispute.aiSummaryGeneratedAt}
        generating={mutations.generatingSummary}
        onGenerate={() => mutations.generateSummary(dispute.id)}
      />

      <PaymentSummary dispute={dispute} />

      <DisputeArguments
        customer={dispute.customer}
        business={dispute.business}
        customerArgument={dispute.customerArgument}
        businessArgument={dispute.businessArgument}
      />

      <DisputeEvidenceGrid urls={dispute.evidenceUrls} />

      {dispute.evidenceRequestNote ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
            {t("evidenceRequested")}
          </h3>
          <p className="text-copy-sm text-pretty">
            {dispute.evidenceRequestNote}
          </p>
          {dispute.evidenceRequestedAt ? (
            <p className="text-muted-foreground text-xs">
              {t("evidenceRequestedAt", {
                date: formatter.dateTime(dispute.evidenceRequestedAt, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      {dispute.resolutionNotes ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
            {t("resolutionNotes")}
          </h3>
          <p className="text-muted-foreground text-copy-sm">
            {dispute.resolutionNotes}
          </p>
        </section>
      ) : null}

      <DisputeResolutionActions
        dispute={dispute}
        onSelect={(selected) => {
          // Asking for evidence moves no money: it has its own dialog.
          if (selected === DisputeResolution.MORE_EVIDENCE) {
            setRequestingEvidence(true);
            return;
          }

          setResolution(selected);
        }}
      />

      <RequestEvidenceDialog
        disputeId={dispute.id}
        disputeTitle={dispute.title}
        open={requestingEvidence}
        loading={mutations.requestingEvidence}
        onOpenChange={setRequestingEvidence}
        onConfirm={mutations.requestEvidence}
      />

      <ResolveDisputeDialog
        dispute={dispute}
        resolution={resolution}
        loading={mutations.pending}
        succeeded={successBeat.succeeded}
        onOpenChange={(open) => {
          if (!open) {
            setResolution(null);
          }
        }}
        onConfirm={mutations.resolve}
      />
    </motion.div>
  );
}
