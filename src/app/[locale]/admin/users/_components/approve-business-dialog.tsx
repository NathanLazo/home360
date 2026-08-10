"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { planCodeSchema, type PlanCode } from "~/lib/subscription/plan-codes";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

const PREFERRED_PLAN: PlanCode = "standard";

export type ApproveBusinessDialogProps = {
  businessId: string | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onConfirm: (input: { businessId: string; planCode: PlanCode }) => void;
};

/**
 * The dialog reads the business detail itself: it is the same cached query the
 * sheet uses, so opening "Approve" from a row never needs the sheet open.
 */
export function ApproveBusinessDialog({
  businessId,
  onOpenChange,
  loading,
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
  const documentTypeT = useTranslations("admin.documentTypes");
  const documentStatusT = useTranslations("admin.documentStatus");
  const formatter = useFormatter();
  const [planCode, setPlanCode] = useState<PlanCode | null>(null);

  const plansQuery = api.admin.users.listApprovalPlans.useQuery(undefined, {
    enabled: open,
  });
  const plans = unwrapEnvelope(plansQuery);

  // The default plan is picked from what the platform can actually sell today:
  // "standard" when available, otherwise the first sellable plan.
  useEffect(() => {
    if (plans.status !== "success" || planCode !== null) {
      return;
    }

    const available = plans.data.filter((plan) => plan.isAvailable);
    const preferred = available.find((plan) => plan.code === PREFERRED_PLAN);
    const fallback = available[0];
    const chosen = preferred ?? fallback;

    if (chosen) {
      setPlanCode(chosen.code);
    }
  }, [plans, planCode]);

  useEffect(() => {
    if (!open) {
      setPlanCode(null);
    }
  }, [open]);

  const currency = (cents: number) =>
    formatter.number(cents / 100, {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    });

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
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
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
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("guarantee")}
              </h3>
              <GuaranteeBadge guaranteeType={business.guaranteeType} />
              {business.guaranteeNotes ? (
                <p className="text-muted-foreground text-sm">
                  {business.guaranteeNotes}
                </p>
              ) : null}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("documents")}
              </h3>
              {business.documents.length === 0 ? (
                <p className="text-muted-foreground text-sm">
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

            <section className="flex flex-col gap-2">
              <Label htmlFor="approve-plan">{t("plan")}</Label>
              {plans.status === "pending" ? (
                <Skeleton className="h-10 w-full rounded-lg" />
              ) : null}
              {plans.status === "error" ? (
                <SectionError
                  title={t("plansErrorTitle")}
                  code={plans.code}
                  onRetry={() => void plansQuery.refetch()}
                />
              ) : null}
              {plans.status === "success" ? (
                <Select
                  value={planCode ?? undefined}
                  onValueChange={(value) =>
                    setPlanCode(planCodeSchema.parse(value))
                  }
                >
                  <SelectTrigger id="approve-plan" className="min-h-11">
                    <SelectValue placeholder={t("planPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.data.map((plan) => (
                      <SelectItem
                        key={plan.code}
                        value={plan.code}
                        disabled={!plan.isAvailable}
                      >
                        {t("planOption", {
                          code: plan.code,
                          price: currency(plan.priceCents),
                          commission: plan.commissionPct,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <p className="text-muted-foreground text-xs">{t("planHint")}</p>
            </section>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-10"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
            disabled={loading || !business || planCode === null}
            onClick={() => {
              if (business && planCode !== null) {
                onConfirm({ businessId: business.id, planCode });
              }
            }}
          >
            {loading ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
