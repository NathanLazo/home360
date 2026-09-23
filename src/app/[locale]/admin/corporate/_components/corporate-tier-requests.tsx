"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { CorporateReasonDialog } from "./corporate-reason-dialog";
import { CorporateTierBadge } from "./corporate-tier-badge";
import type { CorporateTierRequestItem } from "./corporate.types";
import { Button } from "~/components/ui/button";

export type CorporateTierRequestsProps = {
  accountId: string;
  requests: CorporateTierRequestItem[];
  onApprove: (request: CorporateTierRequestItem) => void;
  rejectPending: boolean;
  onReject: (input: {
    accountId: string;
    requestId: string;
    reason: string;
  }) => void;
};

/**
 * Pending tier-change requests of the account. Approving opens the negotiated
 * terms form carrying the `requestId` — the UI never assigns a tier on its
 * own — and rejecting demands a written note.
 */
export function CorporateTierRequests({
  accountId,
  requests,
  onApprove,
  rejectPending,
  onReject,
}: CorporateTierRequestsProps) {
  const t = useTranslations("admin.corporate.requests");
  const formatter = useFormatter();
  const [rejectTarget, setRejectTarget] =
    useState<CorporateTierRequestItem | null>(null);

  if (requests.length === 0) {
    return <p className="text-muted-foreground text-copy-sm">{t("empty")}</p>;
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {requests.map((request) => (
          <li
            key={request.id}
            className="text-copy-sm flex flex-col gap-3 rounded-md border p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  {t("requestedTier")}
                </span>
                <CorporateTierBadge tier={request.requestedTier} />
              </span>
              <time
                dateTime={request.createdAt.toISOString()}
                className="text-muted-foreground text-xs"
                suppressHydrationWarning
              >
                {formatter.dateTime(request.createdAt, { dateStyle: "medium" })}
              </time>
            </div>

            {request.notes ? (
              <p className="text-muted-foreground">{request.notes}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => onApprove(request)}
              >
                {t("approve")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setRejectTarget(request)}
              >
                {t("reject")}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <CorporateReasonDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
          }
        }}
        title={t("rejectTitle")}
        description={t("rejectDescription")}
        confirmLabel={t("rejectConfirm")}
        loading={rejectPending}
        onConfirm={(reason) => {
          if (rejectTarget) {
            onReject({ accountId, requestId: rejectTarget.id, reason });
            setRejectTarget(null);
          }
        }}
      />
    </>
  );
}
