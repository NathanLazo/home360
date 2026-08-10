"use client";

import type { FieldPath, UseFormReturn } from "react-hook-form";
import { useId } from "react";

import type { SettingsFormValues } from "./settings.form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export type SettingsNumberFieldProps = {
  form: UseFormReturn<SettingsFormValues>;
  name: FieldPath<SettingsFormValues>;
  label: string;
  hint?: string;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
};

/**
 * One numeric control for the whole settings screen: every section renders
 * fields through it, so range hints, error wiring and the ± / $ / % affixes
 * stay consistent.
 */
export function SettingsNumberField({
  form,
  name,
  label,
  hint,
  min,
  max,
  step = 1,
  prefix,
  suffix,
}: SettingsNumberFieldProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const error = form.formState.errors[name];
  const registration = form.register(name, { valueAsNumber: true });

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="flex items-center gap-2">
        {prefix ? (
          <span className="text-muted-foreground text-sm">{prefix}</span>
        ) : null}
        <Input
          {...registration}
          id={fieldId}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        {suffix ? (
          <span className="text-muted-foreground text-sm">{suffix}</span>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error.message}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
