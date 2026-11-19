"use client";

import { useTranslations } from "next-intl";

import { ConfirmButtonContent } from "../../_components/confirm-button-content";
import { GuaranteeBadge } from "./guarantee-badge";
import { SectionError } from "~/components/section-error";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

export type ApproveBusinessDialogProps = {
  businessId: string | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  /** The server confirmed; the dialog holds briefly on the check. */
  succeeded?: boolean;
  onConfirm: (input: { businessId: string }) => void;
};

/**
 * The dialog reads the business detail itself: it is the same cached query the
 * sheet uses, so opening "Approve" from a row never needs the sheet open.
 */
export function ApproveBusinessDialog({
  businessId,
  onOpenChange,
  loading,
  succeeded = false,
  onConfirm,
}: ApproveBusinessDialogProps) {
  const open = businessId !== null;
  const detailQuery = api.admin.users.getBusinessDetail.useQuery(
    { businessId: businessId ?? "" },
    { enabled: open },
  );
  const detail = unwrapEnvelope(detailQuery);
  const business = detail.status === "success" ? detail.data : null;
  const t = useTranslations("admin.users.approveDialog");
  const doneT = useTranslations("admin.feedback.done");
  const documentTypeT = useTranslations("admin.documentTypes");
  const documentStatusT = useTranslations("admin.documentStatus");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: business?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>

        {detail.status === "pending" ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-sm" />
          </div>
        ) : null}

        {detail.status === "error" ? (
          <SectionError
            title={t("detailErrorTitle")}
            code={detail.code}
            onRetry={() => void detailQuery.refetch()}
          />
        ) : null}

        {business ? (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
                {t("guarantee")}
              </h3>
              <GuaranteeBadge guaranteeType={business.guaranteeType} />
              {business.guaranteeNotes ? (
                <p className="text-muted-foreground text-copy-sm">
                  {business.guaranteeNotes}
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
                {t("documents")}
              </h3>
              {business.documents.length === 0 ? (
                <p className="text-muted-foreground text-copy-sm">
                  {t("noDocuments")}
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {business.documents.map((document) => (
                    <li key={document.id}>
                      <Badge variant="outline" className="font-normal">
                        {documentTypeT(document.type)} ·{" "}
                        {documentStatusT(document.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-muted-foreground text-copy-sm">
              {t("planHint")}
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={loading || succeeded}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            metal="live"
            metalActive={!succeeded}
            disabled={loading || !business}
            aria-disabled={succeeded || undefined}
            onClick={() => {
              if (!succeeded && business) {
                onConfirm({ businessId: business.id });
              }
            }}
          >
            <ConfirmButtonContent
              loading={loading}
              succeeded={succeeded}
              label={t("confirm")}
              successLabel={doneT("approved")}
            />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
