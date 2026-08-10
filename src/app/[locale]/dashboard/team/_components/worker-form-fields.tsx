"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import type {
  BranchOption,
  WorkerFormErrors,
  WorkerFormValues,
} from "./team.types";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/** Sentinel for "no branch": a Radix `SelectItem` cannot hold an empty value. */
export const NO_BRANCH = "__none__";

export function WorkerFormFields({
  values,
  errors,
  branches,
  isEditing,
  disabled,
  onChange,
}: {
  values: WorkerFormValues;
  errors: WorkerFormErrors;
  branches: BranchOption[];
  isEditing: boolean;
  disabled: boolean;
  onChange: (values: WorkerFormValues) => void;
}) {
  const t = useTranslations("dashboard.team.form");
  const set = (field: keyof WorkerFormValues, value: string) =>
    onChange({ ...values, [field]: value });

  return (
    <div className="flex flex-col gap-5 px-4">
      <Field
        label={t("fullNameLabel")}
        error={errors.fullName}
        htmlFor="worker-fullName"
      >
        <Input
          id="worker-fullName"
          name="fullName"
          value={values.fullName}
          onChange={(event) => set("fullName", event.target.value)}
          placeholder={t("fullNamePlaceholder")}
          autoComplete="off"
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={
            errors.fullName ? "worker-fullName-error" : undefined
          }
          disabled={disabled}
        />
      </Field>

      <Field
        label={t("specialtyLabel")}
        error={errors.specialty}
        htmlFor="worker-specialty"
        hint={t("specialtyHint")}
      >
        <Input
          id="worker-specialty"
          name="specialty"
          value={values.specialty}
          onChange={(event) => set("specialty", event.target.value)}
          placeholder={t("specialtyPlaceholder")}
          autoComplete="off"
          aria-invalid={Boolean(errors.specialty)}
          aria-describedby={
            errors.specialty
              ? "worker-specialty-error"
              : "worker-specialty-hint"
          }
          disabled={disabled}
        />
      </Field>

      {isEditing ? null : (
        <Field
          label={t("invitedEmailLabel")}
          error={errors.invitedEmail}
          htmlFor="worker-invitedEmail"
          hint={t("invitedEmailHint")}
        >
          <Input
            id="worker-invitedEmail"
            name="invitedEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.invitedEmail}
            onChange={(event) => set("invitedEmail", event.target.value)}
            placeholder={t("invitedEmailPlaceholder")}
            aria-invalid={Boolean(errors.invitedEmail)}
            aria-describedby={
              errors.invitedEmail
                ? "worker-invitedEmail-error"
                : "worker-invitedEmail-hint"
            }
            disabled={disabled}
          />
        </Field>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="worker-branch">{t("branchLabel")}</Label>
        <Select
          value={values.branchId === "" ? NO_BRANCH : values.branchId}
          onValueChange={(value) =>
            set("branchId", value === NO_BRANCH ? "" : value)
          }
          disabled={disabled}
        >
          <SelectTrigger
            id="worker-branch"
            className="min-h-11 w-full sm:min-h-10"
            aria-invalid={Boolean(errors.branchId)}
            aria-describedby={
              errors.branchId ? "worker-branchId-error" : undefined
            }
          >
            <SelectValue placeholder={t("branchNone")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_BRANCH}>{t("branchNone")}</SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.branchId ? (
          <p id="worker-branchId-error" className="text-destructive text-sm">
            {errors.branchId}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-muted-foreground text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
