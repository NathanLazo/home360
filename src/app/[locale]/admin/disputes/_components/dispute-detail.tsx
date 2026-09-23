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
import { ResolveDisputeDialog } from "./resolve-dispute-dialog";
import { useDisputeMutations } from "./use-dispute-mutations";
import type { DisputeDetail as DisputeDetailType } from "./disputes.types";
import type { DisputeResolution } from "@generated/prisma";
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
    return <p className="text-muted-foreground text-sm">{t("noPayment")}</p>;
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
  const reduceMotion = useReducedMotion();
  const [resolution, setResolution] = useState<DisputeResolution | null>(null);
  const successBeat = useSuccessBeat();
  const mutations = useDisputeMutations({
    // The check lands on the confirm button before the dialog closes.
    onResolved: () => successBeat.celebrate(() => setResolution(null)),
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
          className="size-9 shrink-0 transition-transform duration-150 ease-out active:scale-[0.96] xl:hidden"
          aria-label={t("back")}
          onClick={onBack}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-balance">
            {dispute.title}
          </h2>
          <p className="text-muted-foreground text-sm">
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
      />

      <DisputeAiSummary summary={dispute.aiSummary} />

      <PaymentSummary dispute={dispute} />

      <DisputeArguments
        customer={dispute.customer}
        business={dispute.business}
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
