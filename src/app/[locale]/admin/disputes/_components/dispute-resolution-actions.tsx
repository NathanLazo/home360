"use client";

import { useTranslations } from "next-intl";

import type { DisputeDetail } from "./disputes.types";
import { DisputeResolution } from "@generated/prisma";
import { MetalRing } from "~/components/metal";
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

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {t("title")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {RESOLUTION_ORDER.map((resolution) => {
          const reason = disabledReason(resolution);
          // With a missing recording, D6 makes the full refund the default
          // path: it becomes the primary button without blocking the others.
          const primary = recordingMissing
            ? resolution === DisputeResolution.FULL_REFUND
            : resolution === DisputeResolution.RELEASE_PAYMENT;

          const button = (
            <Button
              key={resolution}
              type="button"
              variant={primary ? "default" : "outline"}
              className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
              disabled={reason !== null}
              title={reason ?? undefined}
              onClick={() => onSelect(resolution)}
            >
              {t(resolution)}
            </Button>
          );

          // The decisive action of the pane is the only one wearing metal,
          // and only while it can actually be taken.
          if (primary && reason === null) {
            return (
              <MetalRing key={resolution} strength={0.65} bend>
                {button}
              </MetalRing>
            );
          }

          return button;
        })}
      </div>
      {alreadyResolved ? (
        <p className="text-muted-foreground text-sm">
          {t("disabled.alreadyResolved")}
        </p>
      ) : null}
    </section>
  );
}
