"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import type { DisputeDetail } from "./disputes.types";
import { DisputeResolution } from "@generated/prisma";
import { GlassDock } from "~/components/glass";
import { Button } from "~/components/ui/button";

const MONETARY_RESOLUTIONS = [
  DisputeResolution.FULL_REFUND,
  DisputeResolution.PARTIAL_REFUND,
  DisputeResolution.RELEASE_PAYMENT,
] as const;

const RESOLUTION_ORDER = [
  DisputeResolution.FULL_REFUND,
  DisputeResolution.PARTIAL_REFUND,
  DisputeResolution.RELEASE_PAYMENT,
  DisputeResolution.MORE_EVIDENCE,
] as const;

function isMonetary(resolution: DisputeResolution): boolean {
  return MONETARY_RESOLUTIONS.some((value) => value === resolution);
}

export function DisputeResolutionActions({
  dispute,
  onSelect,
}: {
  dispute: DisputeDetail;
  onSelect: (resolution: DisputeResolution) => void;
}) {
  const t = useTranslations("admin.disputes.resolutions");
  const titleId = useId();
  const alreadyResolved = dispute.status === "RESOLVED";
  const escrowed = dispute.payment?.status === "IN_ESCROW";
  const recordingMissing =
    dispute.recordingUrl === null || !dispute.recordingComplete;

  const disabledReason = (resolution: DisputeResolution): string | null => {
    if (alreadyResolved) {
      return t("disabled.alreadyResolved");
    }

    if (isMonetary(resolution) && !escrowed) {
      return t("disabled.notInEscrow");
    }

    return null;
  };

  // With a missing recording, D6 makes the full refund the default path: it
  // becomes the primary action without blocking the others.
  const primaryResolution = recordingMissing
    ? DisputeResolution.FULL_REFUND
    : DisputeResolution.RELEASE_PAYMENT;

  const renderButton = (resolution: DisputeResolution, primary: boolean) => {
    const reason = disabledReason(resolution);

    return (
      <Button
        key={resolution}
        type="button"
        variant={primary ? "default" : "outline"}
        // The decisive action of the pane is the only one wearing live metal
        // (with the liquid dent); `Button` drops the ring while disabled.
        metal={primary ? "bend" : "static"}
        disabled={reason !== null}
        title={reason ?? undefined}
        onClick={() => onSelect(resolution)}
      >
        {t(resolution)}
      </Button>
    );
  };

  const secondary = RESOLUTION_ORDER.filter(
    (resolution) => resolution !== primaryResolution,
  ).map((resolution) => renderButton(resolution, false));

  return (
    <section className="flex flex-col gap-3">
      <h3
        id={titleId}
        className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase"
      >
        {t("title")}
      </h3>
      {alreadyResolved ? (
        <>
          <div className="flex flex-wrap gap-2">
            {RESOLUTION_ORDER.map((resolution) =>
              renderButton(resolution, resolution === primaryResolution),
            )}
          </div>
          <p className="text-muted-foreground text-copy-sm">
            {t("disabled.alreadyResolved")}
          </p>
        </>
      ) : (
        // The screen's glass + metal signature: the verdict bar floats over
        // the file while it scrolls, so the decision stays at hand.
        <GlassDock
          shape="panel"
          role="group"
          aria-labelledby={titleId}
          className="sticky bottom-4 z-10 flex-wrap"
          action={renderButton(primaryResolution, true)}
        >
          {secondary}
        </GlassDock>
      )}
    </section>
  );
}
