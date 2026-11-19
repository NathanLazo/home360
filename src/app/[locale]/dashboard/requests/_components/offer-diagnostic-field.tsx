"use client";

import { useTranslations } from "next-intl";

import { OfferDiagnosticNotice } from "./offer-diagnostic-notice";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

/**
 * Per-offer diagnostic: whether the visit is charged up front, its fee and
 * whether it is deducted from the final charge. Prefilled from the linked
 * service; edits apply to this offer only. The fields collapse (and go inert)
 * while the toggle is off so the form never jumps.
 */
export function OfferDiagnosticField({
  baseId,
  enabled,
  price,
  credited,
  serviceName,
  disabled,
  invalid,
  onEnabledChange,
  onPriceChange,
  onCreditedChange,
}: {
  baseId: string;
  enabled: boolean;
  price: string;
  credited: boolean;
  /** Linked service the terms were taken from, if any. */
  serviceName: string | null;
  disabled: boolean;
  invalid: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onPriceChange: (price: string) => void;
  onCreditedChange: (credited: boolean) => void;
}) {
  const t = useTranslations("dashboard.requests.offerForm");
  const toggleId = `${baseId}-diagnosticEnabled`;
  const toggleHintId = `${baseId}-diagnosticEnabled-hint`;
  const priceId = `${baseId}-diagnosticPrice`;
  const priceErrorId = `${baseId}-diagnosticPrice-error`;
  const creditedId = `${baseId}-diagnosticCredited`;
  const creditedHintId = `${baseId}-diagnosticCredited-hint`;
  const panelId = `${baseId}-diagnostic-panel`;
  const priceCents = Number(price) > 0 ? Math.round(Number(price) * 100) : null;

  return (
    <div className="bg-canvas-soft min-w-0 rounded-xl border">
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 space-y-1">
          <Label htmlFor={toggleId}>{t("diagnosticToggleLabel")}</Label>
          <p
            id={toggleHintId}
            className="text-muted-foreground text-copy-sm text-pretty"
          >
            {t("diagnosticToggleHint")}
          </p>
        </div>
        <Switch
          id={toggleId}
          checked={enabled}
          disabled={disabled}
          aria-describedby={toggleHintId}
          aria-controls={panelId}
          onCheckedChange={onEnabledChange}
          className="mt-0.5"
        />
      </div>

      <div
        id={panelId}
        inert={!enabled}
        data-open={enabled}
        className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] data-[open=true]:grid-rows-[1fr] motion-reduce:transition-none"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-4 border-t px-4 pt-4 pb-4">
            {serviceName ? (
              <p className="text-muted-foreground text-xs text-pretty">
                {t("diagnosticFromService", { service: serviceName })}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor={priceId}>{t("diagnosticPriceLabel")}</Label>
              <Input
                id={priceId}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={price}
                disabled={disabled}
                placeholder={t("pricePlaceholder")}
                aria-invalid={invalid}
                aria-describedby={invalid ? priceErrorId : undefined}
                onChange={(event) => onPriceChange(event.target.value)}
                className="bg-background font-mono tabular-nums"
              />
              {invalid ? (
                <p
                  id={priceErrorId}
                  role="alert"
                  className="text-destructive text-copy-sm"
                >
                  {t("diagnosticPriceError")}
                </p>
              ) : null}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={creditedId}>
                  {t("diagnosticCreditedLabel")}
                </Label>
                <p
                  id={creditedHintId}
                  className="text-muted-foreground text-copy-sm text-pretty"
                >
                  {t("diagnosticCreditedHint")}
                </p>
              </div>
              <Switch
                id={creditedId}
                checked={credited}
                disabled={disabled}
                aria-describedby={creditedHintId}
                onCheckedChange={onCreditedChange}
                className="mt-0.5"
              />
            </div>
            {priceCents !== null ? (
              <OfferDiagnosticNotice
                id={`${baseId}-diagnostic`}
                priceCents={priceCents}
                credited={credited}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
