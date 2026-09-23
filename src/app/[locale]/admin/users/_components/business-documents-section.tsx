"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { useSuccessBeat } from "../../_components/use-success-beat";
import { BusinessDocumentItem } from "./business-document-item";
import { BusinessReasonDialog } from "./business-reason-dialog";
import { useDocumentReview } from "./use-document-review";
import type { BusinessDocumentItem as BusinessDocument } from "./users.types";

export type BusinessDocumentsSectionProps = {
  documents: BusinessDocument[];
  /** Deep link asked for this section: scroll to it and move focus. */
  focused: boolean;
};

/**
 * KYC review inside the business sheet: every document can be approved in
 * one click or rejected with a mandatory note the business will read.
 */
export function BusinessDocumentsSection({
  documents,
  focused,
}: BusinessDocumentsSectionProps) {
  const t = useTranslations("admin.users.documents");
  const detailT = useTranslations("admin.users.detail");
  const doneT = useTranslations("admin.feedback.done");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const successBeat = useSuccessBeat();
  const review = useDocumentReview({
    onSuccess: () => {
      if (rejecting !== null) {
        successBeat.celebrate(() => setRejecting(null));
      }
    },
  });

  useEffect(() => {
    if (!focused) {
      return;
    }

    headingRef.current?.scrollIntoView({ block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [focused]);

  const pendingCount = documents.filter(
    (document) => document.status === "PENDING",
  ).length;

  return (
    <section
      className="flex scroll-mt-4 flex-col gap-3"
      aria-labelledby="business-sheet-documents"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id="business-sheet-documents"
          ref={headingRef}
          tabIndex={-1}
          className="text-muted-foreground text-label rounded-sm font-mono font-medium tracking-wide uppercase focus-visible:outline-none"
        >
          {detailT("documents")}
        </h3>
        {pendingCount > 0 ? (
          <span className="text-muted-foreground text-xs">
            {t("pendingCount", { count: pendingCount })}
          </span>
        ) : null}
      </div>

      {documents.length === 0 ? (
        <p className="text-muted-foreground text-copy-sm">
          {detailT("noDocuments")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => (
            <BusinessDocumentItem
              key={document.id}
              document={document}
              pending={review.pendingDocumentId === document.id}
              locked={
                review.pendingDocumentId !== null &&
                review.pendingDocumentId !== document.id
              }
              onApprove={() =>
                review.run({ documentId: document.id, status: "APPROVED" })
              }
              onReject={() => setRejecting(document.id)}
            />
          ))}
        </ul>
      )}

      <BusinessReasonDialog
        open={rejecting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
          }
        }}
        title={t("rejectDialog.title")}
        description={t("rejectDialog.description")}
        confirmLabel={t("rejectDialog.confirm")}
        successLabel={doneT("rejected")}
        loading={review.pendingDocumentId !== null}
        succeeded={successBeat.succeeded}
        onConfirm={(notes) => {
          if (rejecting !== null) {
            review.run({ documentId: rejecting, status: "REJECTED", notes });
          }
        }}
      />
    </section>
  );
}
