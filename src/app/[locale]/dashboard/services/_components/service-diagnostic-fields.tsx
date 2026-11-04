"use client";

import { useTranslations } from "next-intl";

import type { ServiceFormValues } from "./service.types";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

type DiagnosticValues = Pick<
  ServiceFormValues,
  "diagnosticEnabled" | "diagnosticPrice" | "diagnosticCredited"
>;

/**
 * Initial diagnostic: a paid visit before the business quotes the full job.
 * The fee can be credited (deducted) from that final quote.
 */
export function ServiceDiagnosticFields({
  values,
  error,
  disabled,
  onChange,
}: {
  values: DiagnosticValues;
  error?: string;
  disabled: boolean;
  onChange: (patch: Partial<DiagnosticValues>) => void;
}) {
  const t = useTranslations("dashboard.services.form.diagnostic");

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <ToggleRow
        id="service-diagnostic-enabled"
        label={t("enabledLabel")}
        hint={t("enabledHint")}
        checked={values.diagnosticEnabled}
        disabled={disabled}
        onCheckedChange={(checked) =>
          onChange(
            checked
              ? { diagnosticEnabled: true }
              : { diagnosticEnabled: false, diagnosticCredited: false },
          )
        }
      />

      {values.diagnosticEnabled ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="service-diagnostic-price">{t("priceLabel")}</Label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
                $
              </span>
              <Input
                id="service-diagnostic-price"
                name="diagnosticPrice"
                type="text"
                inputMode="decimal"
                value={values.diagnosticPrice}
                onChange={(event) =>
                  onChange({ diagnosticPrice: event.target.value })
                }
                placeholder={t("pricePlaceholder")}
                className="pl-7 font-mono tabular-nums"
                aria-invalid={Boolean(error)}
                aria-describedby={
                  error ? "service-diagnostic-price-error" : undefined
                }
                disabled={disabled}
              />
            </div>
            {error ? (
              <p
                id="service-diagnostic-price-error"
                role="alert"
                className="text-error-deep text-copy-sm"
              >
                {error}
              </p>
            ) : null}
          </div>

          <ToggleRow
            id="service-diagnostic-credited"
            label={t("creditedLabel")}
            hint={t(
              values.diagnosticCredited ? "creditedHintOn" : "creditedHintOff",
            )}
            checked={values.diagnosticCredited}
            disabled={disabled}
            onCheckedChange={(checked) =>
              onChange({ diagnosticCredited: checked })
            }
          />
        </>
      ) : null}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const hintId = `${id}-hint`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        <p id={hintId} className="text-muted-foreground text-copy-sm">
          {hint}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        aria-describedby={hintId}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
    </div>
  );
}
