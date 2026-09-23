"use client";

import { InfoIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { CorporateTierBadge } from "./corporate-tier-badge";
import {
  corporateTierSchema,
  updateCorporateTermsSchema,
  type CorporateTierValue,
  type UpdateCorporateTermsInput,
} from "./corporate.schema";
import type {
  AccountManagerOption,
  CorporateAccountDetail,
  CorporateTierOption,
} from "./corporate.types";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

/**
 * Reference ticket for the live economic preview: a $1,500.00 MXN order, with
 * the D3 loyalty bonus at 50% of the platform commission. Lowering the
 * preferential commission compounds: the fee drops *and* the provider bonus
 * drops with it, so the platform net moves more than the percentage suggests.
 */
const EXAMPLE_TICKET_CENTS = 150_000;
const LOYALTY_BONUS_PCT = 50;

const NO_MANAGER = "none";

const TIERS_REQUIRING_MANAGER: readonly CorporateTierValue[] = [
  "STANDARD",
  "ENTERPRISE",
  "CUSTOM",
];

export type CorporateTermsTarget = {
  accountId: string;
  /** Present when the edit approves a pending tier-change request. */
  request?: { id: string; requestedTier: CorporateTierValue };
};

function exampleEconomics(commissionPct: number): {
  feeCents: number;
  bonusCents: number;
  netCents: number;
} {
  const feeCents = Math.round((EXAMPLE_TICKET_CENTS * commissionPct) / 100);
  const bonusCents = Math.round((feeCents * LOYALTY_BONUS_PCT) / 100);

  return { feeCents, bonusCents, netCents: feeCents - bonusCents };
}

function parseIntField(value: string): number | null {
  if (!/^\d+$/u.test(value.trim())) {
    return null;
  }

  return Number.parseInt(value.trim(), 10);
}

function parseMoneyToCents(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/u.test(value.trim())) {
    return null;
  }

  return Math.round(Number.parseFloat(value.trim()) * 100);
}

function EconomicsRow({
  label,
  commissionPct,
  highlighted,
}: {
  label: string;
  commissionPct: number;
  highlighted: boolean;
}) {
  const t = useTranslations("admin.corporate.terms.example");
  const currency = useCurrencyFormatter();
  const { feeCents, bonusCents, netCents } = exampleEconomics(commissionPct);

  return (
    <div
      className={
        highlighted
          ? "bg-canvas-soft-2 grid grid-cols-4 gap-2 rounded-sm px-2 py-1.5 font-medium transition-colors duration-200 ease-out"
          : "grid grid-cols-4 gap-2 px-2 py-1.5 transition-colors duration-200 ease-out"
      }
    >
      <span className="text-muted-foreground truncate">{label}</span>
      <span className="text-right tabular-nums">{currency(feeCents)}</span>
      <span className="text-right tabular-nums">{currency(bonusCents)}</span>
      <span className="text-right tabular-nums">{currency(netCents)}</span>
      <span className="sr-only">
        {t("rowSummary", {
          commission: commissionPct,
          fee: currency(feeCents),
          bonus: currency(bonusCents),
          net: currency(netCents),
        })}
      </span>
    </div>
  );
}

function TermsFormBody({
  detail,
  request,
  tiers,
  managers,
  loading,
  onCancel,
  onSubmit,
}: {
  detail: CorporateAccountDetail;
  request: CorporateTermsTarget["request"];
  tiers: CorporateTierOption[];
  managers: AccountManagerOption[];
  loading: boolean;
  onCancel: () => void;
  onSubmit: (input: UpdateCorporateTermsInput) => void;
}) {
  const t = useTranslations("admin.corporate.terms");
  const tierT = useTranslations("admin.corporate.tier");
  const currency = useCurrencyFormatter();
  const baseId = useId();

  const initialTier = request?.requestedTier ?? detail.tier;
  const tierChangedByRequest =
    request !== undefined && request.requestedTier !== detail.tier;

  const defaultsFor = (tier: CorporateTierValue) =>
    tiers.find((option) => option.tier === tier);

  const initialDefaults = tierChangedByRequest
    ? defaultsFor(initialTier)
    : null;

  const [tier, setTier] = useState<CorporateTierValue>(initialTier);
  const [commission, setCommission] = useState(
    String(initialDefaults?.commissionPct ?? detail.commissionPct),
  );
  const [fee, setFee] = useState(
    String((initialDefaults?.monthlyFeeCents ?? detail.monthlyFeeCents) / 100),
  );
  const [maxLocations, setMaxLocations] = useState(() => {
    const initial =
      initialDefaults?.maxLocations ?? detail.maxLocations ?? null;
    return initial === null ? "" : String(initial);
  });
  const [managerId, setManagerId] = useState(
    detail.accountManager?.id ?? NO_MANAGER,
  );
  const [submitted, setSubmitted] = useState(false);

  const applyTier = (nextTier: CorporateTierValue) => {
    setTier(nextTier);
    const defaults = defaultsFor(nextTier);

    if (nextTier === "CUSTOM") {
      // CUSTOM has no catalog: the admin must capture the negotiated terms.
      setCommission("");
      setFee("");
      setMaxLocations("");
      return;
    }

    if (defaults) {
      setCommission(
        defaults.commissionPct === null ? "" : String(defaults.commissionPct),
      );
      setFee(
        defaults.monthlyFeeCents === null
          ? ""
          : String(defaults.monthlyFeeCents / 100),
      );
      setMaxLocations(
        defaults.maxLocations === null ? "" : String(defaults.maxLocations),
      );
    }
  };

  const commissionPct = parseIntField(commission);
  const monthlyFeeCents = parseMoneyToCents(fee);
  const maxLocationsValue =
    maxLocations.trim() === "" ? null : parseIntField(maxLocations);
  const managerMissing =
    TIERS_REQUIRING_MANAGER.includes(tier) && managerId === NO_MANAGER;

  const candidate =
    commissionPct !== null && monthlyFeeCents !== null
      ? updateCorporateTermsSchema.safeParse({
          accountId: detail.id,
          tier,
          commissionPct,
          monthlyFeeCents,
          maxLocations: maxLocations.trim() === "" ? null : maxLocationsValue,
          accountManagerId: managerId === NO_MANAGER ? null : managerId,
          ...(request ? { requestId: request.id } : {}),
        })
      : null;

  const commissionInvalid =
    commissionPct === null || commissionPct < 0 || commissionPct > 100;
  const feeInvalid = monthlyFeeCents === null || monthlyFeeCents <= 0;
  const locationsInvalid =
    maxLocations.trim() !== "" &&
    (maxLocationsValue === null || maxLocationsValue < 1);
  const canSubmit =
    candidate?.success === true &&
    !managerMissing &&
    !commissionInvalid &&
    !feeInvalid &&
    !locationsInvalid;

  const previewCommission = commissionInvalid ? null : commissionPct;

  return (
    <>
      <div className="flex flex-col gap-4">
        {request ? (
          <p className="bg-canvas-soft text-copy-sm flex items-center gap-2 rounded-md border p-3">
            <InfoIcon
              aria-hidden="true"
              className="text-muted-foreground size-4 shrink-0"
            />
            {t("approvingRequest", { tier: tierT(request.requestedTier) })}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${baseId}-tier`}>{t("fields.tier")}</Label>
          {request ? (
            <div className="flex min-h-11 items-center sm:min-h-10">
              <CorporateTierBadge tier={request.requestedTier} />
            </div>
          ) : (
            <Select
              value={tier}
              onValueChange={(value) =>
                applyTier(corporateTierSchema.parse(value))
              }
            >
              <SelectTrigger
                id={`${baseId}-tier`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {corporateTierSchema.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tierT(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${baseId}-commission`}>
              {t("fields.commission")}
            </Label>
            <Input
              id={`${baseId}-commission`}
              inputMode="numeric"
              value={commission}
              aria-invalid={submitted && commissionInvalid}
              aria-describedby={
                submitted && commissionInvalid
                  ? `${baseId}-commission-error`
                  : `${baseId}-commission-hint`
              }
              onChange={(event) => setCommission(event.target.value)}
            />
            {submitted && commissionInvalid ? (
              <p
                id={`${baseId}-commission-error`}
                role="alert"
                className="text-destructive text-copy-sm"
              >
                {t("fields.commissionInvalid")}
              </p>
            ) : (
              <p
                id={`${baseId}-commission-hint`}
                className="text-muted-foreground text-xs"
              >
                {tier === "CUSTOM"
                  ? t("fields.commissionHintCustom")
                  : t("fields.commissionHint")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${baseId}-fee`}>{t("fields.monthlyFee")}</Label>
            <Input
              id={`${baseId}-fee`}
              inputMode="decimal"
              value={fee}
              aria-invalid={submitted && feeInvalid}
              aria-describedby={
                submitted && feeInvalid
                  ? `${baseId}-fee-error`
                  : `${baseId}-fee-hint`
              }
              onChange={(event) => setFee(event.target.value)}
            />
            {submitted && feeInvalid ? (
              <p
                id={`${baseId}-fee-error`}
                role="alert"
                className="text-destructive text-copy-sm"
              >
                {t("fields.monthlyFeeInvalid")}
              </p>
            ) : (
              <p
                id={`${baseId}-fee-hint`}
                className="text-muted-foreground text-xs"
              >
                {t("fields.monthlyFeeHint")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${baseId}-locations`}>
              {t("fields.maxLocations")}
            </Label>
            <Input
              id={`${baseId}-locations`}
              inputMode="numeric"
              value={maxLocations}
              placeholder={t("fields.maxLocationsUnlimited")}
              aria-invalid={submitted && locationsInvalid}
              aria-describedby={
                submitted && locationsInvalid
                  ? `${baseId}-locations-error`
                  : `${baseId}-locations-hint`
              }
              onChange={(event) => setMaxLocations(event.target.value)}
            />
            {submitted && locationsInvalid ? (
              <p
                id={`${baseId}-locations-error`}
                role="alert"
                className="text-destructive text-copy-sm"
              >
                {t("fields.maxLocationsInvalid")}
              </p>
            ) : (
              <p
                id={`${baseId}-locations-hint`}
                className="text-muted-foreground text-xs"
              >
                {t("fields.maxLocationsHint", {
                  active: detail.activeLocations,
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${baseId}-manager`}>{t("fields.manager")}</Label>
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger
              id={`${baseId}-manager`}
              aria-invalid={submitted && managerMissing}
              aria-describedby={
                submitted && managerMissing
                  ? `${baseId}-manager-error`
                  : `${baseId}-manager-hint`
              }
            >
              <SelectValue placeholder={t("fields.managerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MANAGER}>
                {t("fields.managerNone")}
              </SelectItem>
              {managers.map((manager) => (
                <SelectItem key={manager.id} value={manager.id}>
                  {manager.name ?? manager.email ?? manager.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {submitted && managerMissing ? (
            <p
              id={`${baseId}-manager-error`}
              role="alert"
              className="text-destructive text-copy-sm"
            >
              {t("fields.managerRequired")}
            </p>
          ) : (
            <p
              id={`${baseId}-manager-hint`}
              className="text-muted-foreground text-xs"
            >
              {t("fields.managerHint")}
            </p>
          )}
        </div>

        <section
          aria-label={t("example.title", {
            ticket: currency(EXAMPLE_TICKET_CENTS),
          })}
          className="flex flex-col gap-2 rounded-md border p-3"
        >
          <h3 className="text-muted-foreground text-label font-mono font-medium tracking-wide uppercase">
            {t("example.title", { ticket: currency(EXAMPLE_TICKET_CENTS) })}
          </h3>
          <div className="text-copy-sm">
            <div className="text-muted-foreground grid grid-cols-4 gap-2 px-2 py-1 text-xs">
              <span>{t("example.commission")}</span>
              <span className="text-right">{t("example.fee")}</span>
              <span className="text-right">{t("example.bonus")}</span>
              <span className="text-right">{t("example.net")}</span>
            </div>
            <EconomicsRow
              label={t("example.currentRow", {
                commission: detail.commissionPct,
              })}
              commissionPct={detail.commissionPct}
              highlighted={false}
            />
            {previewCommission !== null ? (
              <EconomicsRow
                label={t("example.newRow", { commission: previewCommission })}
                commissionPct={previewCommission}
                highlighted
              />
            ) : (
              <p className="text-muted-foreground text-copy-sm px-2 py-1.5">
                {t("example.awaitingCommission")}
              </p>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            {t("example.bonusNote", { pct: LOYALTY_BONUS_PCT })}
          </p>
        </section>

        <p
          role="note"
          className="bg-canvas-soft-2 text-body text-copy-sm flex items-start gap-2 rounded-md p-3"
        >
          <InfoIcon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
          {t("scopeNote")}
        </p>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          disabled={loading || (submitted && !canSubmit)}
          onClick={() => {
            setSubmitted(true);

            if (candidate?.success === true && canSubmit) {
              onSubmit(candidate.data);
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
    </>
  );
}

export type CorporateTermsFormProps = {
  target: CorporateTermsTarget | null;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onSubmit: (input: UpdateCorporateTermsInput) => void;
};

/**
 * Negotiated terms editor (updateTerms). Shows the compound economic effect of
 * the preferential commission *before* saving and carries the persistent note
 * that terms only apply to future orders — historical payments froze their
 * commission at capture and are never rewritten.
 */
export function CorporateTermsForm({
  target,
  onOpenChange,
  loading,
  onSubmit,
}: CorporateTermsFormProps) {
  const t = useTranslations("admin.corporate.terms");
  const open = target !== null;

  const detailQuery = api.admin.corporate.getById.useQuery(
    { accountId: target?.accountId ?? "" },
    { enabled: open },
  );
  const detail = unwrapEnvelope(detailQuery);

  const tiersQuery = api.admin.corporate.listTiers.useQuery(undefined, {
    enabled: open,
  });
  const tiers = unwrapEnvelope(tiersQuery);

  const managersQuery = api.admin.corporate.listAccountManagers.useQuery(
    undefined,
    { enabled: open },
  );
  const managers = unwrapEnvelope(managersQuery);

  const ready =
    detail.status === "success" &&
    tiers.status === "success" &&
    managers.status === "success";
  const failed =
    detail.status === "error" ||
    tiers.status === "error" ||
    managers.status === "error";
  const errorCode =
    detail.status === "error"
      ? detail.code
      : tiers.status === "error"
        ? tiers.code
        : managers.status === "error"
          ? managers.code
          : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {!ready && !failed ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-10 w-full rounded-sm" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
          </div>
        ) : null}

        {failed && errorCode ? (
          <SectionError
            title={t("errorTitle")}
            code={errorCode}
            onRetry={() => {
              void detailQuery.refetch();
              void tiersQuery.refetch();
              void managersQuery.refetch();
            }}
          />
        ) : null}

        {ready &&
        detail.status === "success" &&
        tiers.status === "success" &&
        managers.status === "success" ? (
          <TermsFormBody
            key={`${target?.accountId ?? ""}:${target?.request?.id ?? ""}`}
            detail={detail.data}
            request={target?.request}
            tiers={tiers.data}
            managers={managers.data}
            loading={loading}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
