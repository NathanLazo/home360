"use client";

import { LoaderCircleIcon, MailIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import {
  corporateTierSchema,
  createCorporateAccountSchema,
  type CorporateTierValue,
  type CreateCorporateAccountInput,
} from "./corporate.schema";
import type {
  AccountManagerOption,
  CorporateTierOption,
} from "./corporate.types";
import { useCurrencyFormatter } from "../../_components/use-currency-formatter";
import { useErrorShake } from "~/components/motion";
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

const NO_MANAGER = "none";
const EMAIL_LOCALES = ["es", "en"] as const;

type EmailLocale = (typeof EMAIL_LOCALES)[number];

const TIERS_REQUIRING_MANAGER: readonly CorporateTierValue[] = [
  "STANDARD",
  "ENTERPRISE",
  "CUSTOM",
];

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

function CreateFormBody({
  tiers,
  managers,
  loading,
  onCancel,
  onSubmit,
}: {
  tiers: CorporateTierOption[];
  managers: AccountManagerOption[];
  loading: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateCorporateAccountInput) => void;
}) {
  const t = useTranslations("admin.corporate.create");
  const tierT = useTranslations("admin.corporate.tier");
  const locale = useLocale();
  const currency = useCurrencyFormatter();
  const baseId = useId();

  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [emailLocale, setEmailLocale] = useState<EmailLocale>(
    locale === "en" ? "en" : "es",
  );
  const [tier, setTier] = useState<CorporateTierValue | null>(null);
  const [commission, setCommission] = useState("");
  const [fee, setFee] = useState("");
  const [maxLocations, setMaxLocations] = useState("");
  const [managerId, setManagerId] = useState(NO_MANAGER);
  const [submitted, setSubmitted] = useState(false);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const shakeInvalid = useErrorShake();

  const applyTier = (nextTier: CorporateTierValue) => {
    setTier(nextTier);
    const defaults = tiers.find((option) => option.tier === nextTier);

    if (nextTier === "CUSTOM" || !defaults) {
      setCommission("");
      setFee("");
      setMaxLocations("");
      return;
    }

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
  };

  const commissionPct = parseIntField(commission);
  const monthlyFeeCents = parseMoneyToCents(fee);
  const maxLocationsValue =
    maxLocations.trim() === "" ? null : parseIntField(maxLocations);
  const managerMissing =
    tier !== null &&
    TIERS_REQUIRING_MANAGER.includes(tier) &&
    managerId === NO_MANAGER;
  const customTermsMissing =
    tier === "CUSTOM" && (commissionPct === null || monthlyFeeCents === null);

  const candidate =
    tier !== null
      ? createCorporateAccountSchema.safeParse({
          name: name.trim(),
          ...(taxId.trim().length > 0 ? { taxId: taxId.trim() } : {}),
          ownerEmail: email.trim(),
          tier,
          ...(commissionPct !== null ? { commissionPct } : {}),
          ...(monthlyFeeCents !== null ? { monthlyFeeCents } : {}),
          ...(maxLocations.trim() === ""
            ? tier === "CUSTOM"
              ? { maxLocations: null }
              : {}
            : maxLocationsValue !== null
              ? { maxLocations: maxLocationsValue }
              : {}),
          ...(managerId === NO_MANAGER ? {} : { accountManagerId: managerId }),
          locale: emailLocale,
        })
      : null;

  const canSubmit =
    candidate?.success === true && !managerMissing && !customTermsMissing;

  const nameInvalid = name.trim().length < 2;
  const emailInvalid = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email.trim());

  return (
    <>
      <div ref={fieldsRef} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${baseId}-name`}>{t("fields.name")}</Label>
            <Input
              id={`${baseId}-name`}
              value={name}
              aria-invalid={submitted && nameInvalid}
              aria-describedby={
                submitted && nameInvalid ? `${baseId}-name-error` : undefined
              }
              onChange={(event) => setName(event.target.value)}
            />
            {submitted && nameInvalid ? (
              <p
                id={`${baseId}-name-error`}
                role="alert"
                className="text-destructive text-sm"
              >
                {t("fields.nameInvalid")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${baseId}-taxid`}>{t("fields.taxId")}</Label>
            <Input
              id={`${baseId}-taxid`}
              value={taxId}
              placeholder={t("fields.taxIdPlaceholder")}
              onChange={(event) => setTaxId(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${baseId}-email`}>{t("fields.ownerEmail")}</Label>
            <Input
              id={`${baseId}-email`}
              type="email"
              value={email}
              autoComplete="off"
              aria-invalid={submitted && emailInvalid}
              aria-describedby={
                submitted && emailInvalid ? `${baseId}-email-error` : undefined
              }
              onChange={(event) => setEmail(event.target.value)}
            />
            {submitted && emailInvalid ? (
              <p
                id={`${baseId}-email-error`}
                role="alert"
                className="text-destructive text-sm"
              >
                {t("fields.ownerEmailInvalid")}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${baseId}-locale`}>{t("fields.locale")}</Label>
            <Select
              value={emailLocale}
              onValueChange={(value) =>
                setEmailLocale(value === "en" ? "en" : "es")
              }
            >
              <SelectTrigger
                id={`${baseId}-locale`}
                className="min-h-11 w-28 sm:min-h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_LOCALES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`fields.localeOptions.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-lg bg-zinc-100 p-3 text-sm text-zinc-700">
          <MailIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-zinc-500"
          />
          {t("invitationNote")}
        </p>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${baseId}-tier`}>{t("fields.tier")}</Label>
          <Select
            value={tier ?? undefined}
            onValueChange={(value) =>
              applyTier(corporateTierSchema.parse(value))
            }
          >
            <SelectTrigger
              id={`${baseId}-tier`}
              className="min-h-11 sm:min-h-10"
              aria-invalid={submitted && tier === null}
              aria-describedby={
                submitted && tier === null
                  ? `${baseId}-tier-error`
                  : `${baseId}-tier-hint`
              }
            >
              <SelectValue placeholder={t("fields.tierPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {corporateTierSchema.options.map((option) => {
                const config = tiers.find(
                  (candidateTier) => candidateTier.tier === option,
                );

                return (
                  <SelectItem key={option} value={option}>
                    {config?.monthlyFeeCents != null &&
                    config.commissionPct !== null
                      ? t("fields.tierOption", {
                          tier: tierT(option),
                          fee: currency(config.monthlyFeeCents),
                          commission: config.commissionPct,
                        })
                      : tierT(option)}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {submitted && tier === null ? (
            <p
              id={`${baseId}-tier-error`}
              role="alert"
              className="text-destructive text-sm"
            >
              {t("fields.tierRequired")}
            </p>
          ) : (
            <p
              id={`${baseId}-tier-hint`}
              className="text-muted-foreground text-xs"
            >
              {t("fields.tierHint")}
            </p>
          )}
        </div>

        {tier !== null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${baseId}-commission`}>
                {t("fields.commission")}
              </Label>
              <Input
                id={`${baseId}-commission`}
                inputMode="numeric"
                value={commission}
                aria-invalid={
                  submitted && tier === "CUSTOM" && commissionPct === null
                }
                aria-describedby={
                  submitted && tier === "CUSTOM" && commissionPct === null
                    ? `${baseId}-commission-error`
                    : `${baseId}-commission-hint`
                }
                onChange={(event) => setCommission(event.target.value)}
              />
              {submitted && tier === "CUSTOM" && commissionPct === null ? (
                <p
                  id={`${baseId}-commission-error`}
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {t("fields.commissionRequired")}
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
                aria-invalid={
                  submitted && tier === "CUSTOM" && monthlyFeeCents === null
                }
                aria-describedby={
                  submitted && tier === "CUSTOM" && monthlyFeeCents === null
                    ? `${baseId}-fee-error`
                    : `${baseId}-fee-hint`
                }
                onChange={(event) => setFee(event.target.value)}
              />
              {submitted && tier === "CUSTOM" && monthlyFeeCents === null ? (
                <p
                  id={`${baseId}-fee-error`}
                  role="alert"
                  className="text-destructive text-sm"
                >
                  {t("fields.monthlyFeeRequired")}
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
                placeholder={
                  tier === "CUSTOM"
                    ? t("fields.maxLocationsUnlimited")
                    : undefined
                }
                aria-describedby={`${baseId}-locations-hint`}
                onChange={(event) => setMaxLocations(event.target.value)}
              />
              <p
                id={`${baseId}-locations-hint`}
                className="text-muted-foreground text-xs"
              >
                {t("fields.maxLocationsHint")}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${baseId}-manager`}>{t("fields.manager")}</Label>
          <Select value={managerId} onValueChange={setManagerId}>
            <SelectTrigger
              id={`${baseId}-manager`}
              className="min-h-11 sm:min-h-10"
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
              className="text-destructive text-sm"
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
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 sm:min-h-10"
          disabled={loading}
          onClick={onCancel}
        >
          {t("cancel")}
        </Button>
        <Button
          type="button"
          className="min-h-11 transition-transform duration-150 ease-out active:scale-[0.96] sm:min-h-10"
          disabled={loading || (submitted && !canSubmit)}
          onClick={() => {
            setSubmitted(true);

            if (candidate?.success === true && canSubmit) {
              onSubmit(candidate.data);
              return;
            }

            shakeInvalid(fieldsRef.current);
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

export type CreateCorporateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onSubmit: (input: CreateCorporateAccountInput) => void;
};

/**
 * Account creation via email invitation: there is no password field anywhere —
 * the owner sets their own credentials through the secure link they receive.
 * Tier defaults prefill the negotiated terms; CUSTOM forces explicit capture.
 */
export function CreateCorporateDialog({
  open,
  onOpenChange,
  loading,
  onSubmit,
}: CreateCorporateDialogProps) {
  const t = useTranslations("admin.corporate.create");

  const tiersQuery = api.admin.corporate.listTiers.useQuery(undefined, {
    enabled: open,
  });
  const tiers = unwrapEnvelope(tiersQuery);

  const managersQuery = api.admin.corporate.listAccountManagers.useQuery(
    undefined,
    { enabled: open },
  );
  const managers = unwrapEnvelope(managersQuery);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {tiers.status === "pending" || managers.status === "pending" ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ) : null}

        {tiers.status === "error" ? (
          <SectionError
            title={t("errorTitle")}
            code={tiers.code}
            onRetry={() => void tiersQuery.refetch()}
          />
        ) : null}

        {tiers.status === "success" && managers.status === "error" ? (
          <SectionError
            title={t("errorTitle")}
            code={managers.code}
            onRetry={() => void managersQuery.refetch()}
          />
        ) : null}

        {tiers.status === "success" && managers.status === "success" ? (
          <CreateFormBody
            key={open ? "open" : "closed"}
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
