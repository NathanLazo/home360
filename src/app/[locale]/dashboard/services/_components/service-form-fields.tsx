"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  ServiceFormErrors,
  ServiceFormValues,
  ServiceWorker,
} from "./service.types";
import { FormSection, FormSectionDivider } from "~/components/form-section";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

export function ServiceFormFields({
  values,
  errors,
  categories,
  workers,
  disabled,
  onChange,
}: {
  values: ServiceFormValues;
  errors: ServiceFormErrors;
  categories: string[];
  workers: ServiceWorker[];
  disabled: boolean;
  onChange: (values: ServiceFormValues) => void;
}) {
  const t = useTranslations("dashboard.services.form");
  const set = (field: keyof ServiceFormValues, value: string | string[]) =>
    onChange({ ...values, [field]: value });
  const toggleWorker = (id: string) =>
    set(
      "workerIds",
      values.workerIds.includes(id)
        ? values.workerIds.filter((workerId) => workerId !== id)
        : [...values.workerIds, id],
    );
  const selectedCount = values.workerIds.length;

  return (
    <div className="flex flex-col gap-6">
      <FormSection
        title={t("sections.basics")}
        description={t("sections.basicsDescription")}
      >
        <Field
          label={t("nameLabel")}
          error={errors.name}
          htmlFor="service-name"
        >
          <Input
            id="service-name"
            name="name"
            value={values.name}
            onChange={(event) => set("name", event.target.value)}
            placeholder={t("namePlaceholder")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "service-name-error" : undefined}
            disabled={disabled}
          />
        </Field>

        <Field
          label={t("categoryLabel")}
          error={errors.category}
          htmlFor="service-category"
        >
          <Input
            id="service-category"
            name="category"
            list="service-category-suggestions"
            value={values.category}
            onChange={(event) => set("category", event.target.value)}
            placeholder={t("categoryPlaceholder")}
            aria-invalid={Boolean(errors.category)}
            aria-describedby={
              errors.category ? "service-category-error" : undefined
            }
            disabled={disabled}
          />
          <datalist id="service-category-suggestions">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
      </FormSection>

      <FormSectionDivider />

      <FormSection
        title={t("sections.pricing")}
        description={t("sections.pricingDescription")}
      >
        <Field
          label={t("priceLabel")}
          error={errors.price}
          htmlFor="service-price"
        >
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
              $
            </span>
            <Input
              id="service-price"
              name="price"
              type="text"
              inputMode="decimal"
              value={values.price}
              onChange={(event) => set("price", event.target.value)}
              placeholder={t("pricePlaceholder")}
              className="pl-7 font-mono tabular-nums"
              aria-invalid={Boolean(errors.price)}
              aria-describedby={
                errors.price ? "service-price-error" : undefined
              }
              disabled={disabled}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("durationLabel")}
            error={errors.duration}
            htmlFor="service-duration"
          >
            <UnitInput unit={t("minutesUnit")}>
              <Input
                id="service-duration"
                name="duration"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                value={values.duration}
                onChange={(event) => set("duration", event.target.value)}
                placeholder={t("durationPlaceholder")}
                className="pr-12 font-mono tabular-nums"
                aria-invalid={Boolean(errors.duration)}
                aria-describedby={
                  errors.duration ? "service-duration-error" : undefined
                }
                disabled={disabled}
              />
            </UnitInput>
          </Field>
          <Field
            label={t("durationMaxLabel")}
            error={errors.durationMax}
            htmlFor="service-duration-max"
          >
            <UnitInput unit={t("minutesUnit")}>
              <Input
                id="service-duration-max"
                name="durationMax"
                type="number"
                inputMode="numeric"
                min={1}
                max={10080}
                value={values.durationMax}
                onChange={(event) => set("durationMax", event.target.value)}
                placeholder={t("optional")}
                className="pr-12 font-mono tabular-nums"
                aria-invalid={Boolean(errors.durationMax)}
                aria-describedby={
                  errors.durationMax ? "service-duration-max-error" : undefined
                }
                disabled={disabled}
              />
            </UnitInput>
          </Field>
        </div>
      </FormSection>

      <FormSectionDivider />

      <FormSection
        title={t("sections.team")}
        description={t("sections.teamDescription")}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label id="service-workers-label" htmlFor="service-workers-search">
              {t("workersLabel")}
            </Label>
            <span
              className="text-muted-foreground font-mono text-xs tabular-nums"
              aria-live="polite"
            >
              {t("workersSelected", { count: selectedCount })}
            </span>
          </div>
          <Command className="rounded-xl border">
            <CommandInput
              id="service-workers-search"
              placeholder={t("workersSearchPlaceholder")}
              aria-invalid={Boolean(errors.workerIds)}
              aria-describedby={
                errors.workerIds ? "service-workerIds-error" : undefined
              }
            />
            <CommandList
              role="listbox"
              aria-multiselectable="true"
              aria-labelledby="service-workers-label"
              className="max-h-56"
            >
              <CommandEmpty>{t("workersEmpty")}</CommandEmpty>
              {workers.map((worker) => {
                const selected = values.workerIds.includes(worker.id);
                return (
                  <CommandItem
                    key={worker.id}
                    value={`${worker.fullName} ${worker.id}`}
                    onSelect={() => toggleWorker(worker.id)}
                    role="option"
                    aria-selected={selected}
                    disabled={disabled}
                    className="min-h-10"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-4 items-center justify-center rounded border transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
                        selected
                          ? "bg-ink text-on-ink border-ink"
                          : "border-input",
                      )}
                    >
                      {selected ? <CheckIcon className="size-3" /> : null}
                    </span>
                    {worker.fullName}
                  </CommandItem>
                );
              })}
            </CommandList>
          </Command>
          {errors.workerIds ? (
            <p
              id="service-workerIds-error"
              role="alert"
              className="text-error-deep text-copy-sm"
            >
              {errors.workerIds}
            </p>
          ) : null}
        </div>
      </FormSection>
    </div>
  );
}

function UnitInput({
  unit,
  children,
}: {
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <span
        aria-hidden="true"
        className="text-muted-foreground text-copy-sm pointer-events-none absolute inset-y-0 right-3 flex items-center"
      >
        {unit}
      </span>
    </div>
  );
}

function Field({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-error-deep text-copy-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
