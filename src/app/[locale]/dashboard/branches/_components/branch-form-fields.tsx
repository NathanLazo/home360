"use client";

import { useTranslations } from "next-intl";

import { BranchLocationFields } from "./branch-location-fields";
import type { BranchFormErrors, BranchFormValues } from "./branch.types";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function BranchFormFields({
  values,
  errors,
  disabled,
  onChange,
}: {
  values: BranchFormValues;
  errors: BranchFormErrors;
  disabled: boolean;
  onChange: (values: BranchFormValues) => void;
}) {
  const t = useTranslations("dashboard.branches.form");

  function field(
    name: keyof BranchFormValues,
    value: string,
  ): BranchFormValues {
    return { ...values, [name]: value };
  }

  return (
    <div className="grid gap-5 px-4">
      <div className="grid gap-2">
        <Label htmlFor="branch-name">{t("name")}</Label>
        <Input
          id="branch-name"
          autoComplete="organization"
          value={values.name}
          disabled={disabled}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "branch-name-error" : undefined}
          onChange={(event) => onChange(field("name", event.target.value))}
        />
        {errors.name ? (
          <p
            id="branch-name-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="branch-address">{t("address")}</Label>
        <Input
          id="branch-address"
          autoComplete="street-address"
          value={values.address}
          disabled={disabled}
          aria-invalid={Boolean(errors.address)}
          aria-describedby={errors.address ? "branch-address-error" : undefined}
          onChange={(event) => onChange(field("address", event.target.value))}
        />
        {errors.address ? (
          <p
            id="branch-address-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {errors.address}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="branch-manager">{t("manager")}</Label>
        <Input
          id="branch-manager"
          autoComplete="name"
          value={values.managerName}
          disabled={disabled}
          aria-invalid={Boolean(errors.managerName)}
          aria-describedby={
            errors.managerName ? "branch-manager-error" : "branch-manager-help"
          }
          onChange={(event) =>
            onChange(field("managerName", event.target.value))
          }
        />
        <p
          id="branch-manager-help"
          className="text-muted-foreground text-copy-sm"
        >
          {t("managerOptional")}
        </p>
        {errors.managerName ? (
          <p
            id="branch-manager-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {errors.managerName}
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="branch-coverage">{t("coverage")}</Label>
        <div className="relative">
          <Input
            id="branch-coverage"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            step={1}
            value={values.coverageRadiusKm}
            disabled={disabled}
            className="pr-12"
            aria-invalid={Boolean(errors.coverageRadiusKm)}
            aria-describedby={
              errors.coverageRadiusKm
                ? "branch-coverage-error"
                : "branch-coverage-help"
            }
            onChange={(event) =>
              onChange(field("coverageRadiusKm", event.target.value))
            }
          />
          <span
            aria-hidden="true"
            className="text-muted-foreground text-copy-sm pointer-events-none absolute inset-y-0 right-3 flex items-center"
          >
            km
          </span>
        </div>
        <p
          id="branch-coverage-help"
          className="text-muted-foreground text-copy-sm"
        >
          {t("coverageHelp")}
        </p>
        {errors.coverageRadiusKm ? (
          <p
            id="branch-coverage-error"
            role="alert"
            className="text-error-deep text-copy-sm"
          >
            {errors.coverageRadiusKm}
          </p>
        ) : null}
      </div>

      <BranchLocationFields
        values={values}
        errors={errors}
        disabled={disabled}
        onChange={(location) => onChange({ ...values, ...location })}
      />
    </div>
  );
}
