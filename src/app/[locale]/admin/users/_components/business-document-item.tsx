"use client";

import { CheckIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { BusinessDocumentPreview } from "./business-document-preview";
import type { BusinessDocumentItem as BusinessDocument } from "./users.types";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "~/components/status-badge";
import { Button } from "~/components/ui/button";

const documentStatusVariants: Record<
  BusinessDocument["status"],
  StatusBadgeVariant
> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
};

export type BusinessDocumentItemProps = {
  document: BusinessDocument;
  /** This document has a verdict in flight. */
  pending: boolean;
  /** Another document has a verdict in flight; avoid racing verdicts. */
  locked: boolean;
  onApprove: () => void;
  onReject: () => void;
};

export function BusinessDocumentItem({
  document,
  pending,
  locked,
  onApprove,
  onReject,
}: BusinessDocumentItemProps) {
  const t = useTranslations("admin.users.documents");
  const documentTypeT = useTranslations("admin.documentTypes");
  const documentStatusT = useTranslations("admin.documentStatus");
  const formatter = useFormatter();
  const label = documentTypeT(document.type);

  return (
    <li className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <BusinessDocumentPreview document={document} label={label} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-copy-sm truncate font-medium">{label}</span>
            <StatusBadge
              status={document.status}
              variantMap={documentStatusVariants}
              label={documentStatusT(document.status)}
            />
          </div>
          <span
            className="text-muted-foreground text-xs"
            suppressHydrationWarning
          >
            {document.reviewedAt
              ? t("reviewedAt", {
                  date: formatter.dateTime(document.reviewedAt, {
                    dateStyle: "medium",
                  }),
                  reviewer: document.reviewedByName ?? t("unknownReviewer"),
                })
              : t("uploadedAt", {
                  date: formatter.dateTime(document.createdAt, {
                    dateStyle: "medium",
                  }),
                })}
          </span>
          {document.notes ? (
            <p className="text-muted-foreground text-xs text-pretty">
              {t("notes", { notes: document.notes })}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {document.status !== "REJECTED" ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending || locked}
            aria-label={t("rejectLabel", { name: label })}
            onClick={onReject}
          >
            <XIcon aria-hidden="true" />
            {t("reject")}
          </Button>
        ) : null}
        {document.status !== "APPROVED" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || locked}
            aria-label={t("approveLabel", { name: label })}
            onClick={onApprove}
          >
            {pending ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <CheckIcon aria-hidden="true" />
            )}
            {t("approve")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
