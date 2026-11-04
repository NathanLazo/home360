"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { SERVICE_CATEGORIES_MAX } from "./service.schema";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Label } from "~/components/ui/label";
import { useCategoryLabel } from "~/hooks/use-category-label";
import { cn } from "~/lib/utils";
import {
  REQUEST_CATEGORIES,
  type RequestCategory,
} from "~/schemas/marketplace/request-categories";

/**
 * Multi-select over the fixed marketplace taxonomy. Selected categories are
 * removable chips (the first one is the service's primary category); the
 * searchable list toggles them up to `SERVICE_CATEGORIES_MAX`.
 */
export function ServiceCategoriesField({
  value,
  error,
  disabled,
  onChange,
}: {
  value: RequestCategory[];
  error?: string;
  disabled: boolean;
  onChange: (categories: RequestCategory[]) => void;
}) {
  const t = useTranslations("dashboard.services.form");
  const label = useCategoryLabel();
  const full = value.length >= SERVICE_CATEGORIES_MAX;

  const toggle = (category: RequestCategory) =>
    onChange(
      value.includes(category)
        ? value.filter((item) => item !== category)
        : full
          ? value
          : [...value, category],
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label id="service-categories-label" htmlFor="service-categories">
          {t("categoriesLabel")}
        </Label>
        <span
          className="text-muted-foreground font-mono text-xs tabular-nums"
          aria-live="polite"
        >
          {t("categoriesSelected", {
            count: value.length,
            max: SERVICE_CATEGORIES_MAX,
          })}
        </span>
      </div>

      {value.length > 0 ? (
        <ul
          className="flex flex-wrap gap-1.5"
          aria-label={t("categoriesLabel")}
        >
          {value.map((category, index) => (
            <li key={category}>
              <button
                type="button"
                onClick={() => toggle(category)}
                disabled={disabled}
                aria-label={t("categoryRemove", { category: label(category) })}
                className={cn(
                  "text-copy-sm inline-flex h-7 items-center gap-1 rounded-full border px-2.5 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] motion-reduce:transition-none",
                  index === 0
                    ? "bg-ink text-on-ink border-ink"
                    : "bg-background hover:bg-muted border-input",
                )}
              >
                {label(category)}
                <XIcon aria-hidden="true" className="size-3 opacity-70" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Command className="rounded-xl border">
        <CommandInput
          id="service-categories"
          placeholder={t("categoriesSearchPlaceholder")}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? "service-categories-error" : "service-categories-hint"
          }
        />
        <CommandList
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby="service-categories-label"
          className="max-h-56"
        >
          <CommandEmpty>{t("categoriesEmpty")}</CommandEmpty>
          {REQUEST_CATEGORIES.map((category) => {
            const selected = value.includes(category);
            return (
              <CommandItem
                key={category}
                value={`${label(category)} ${category}`}
                onSelect={() => toggle(category)}
                role="option"
                aria-selected={selected}
                disabled={disabled || (full && !selected)}
                className="min-h-10"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-4 items-center justify-center rounded border transition-[background-color,border-color] duration-150 motion-reduce:transition-none",
                    selected ? "bg-ink text-on-ink border-ink" : "border-input",
                  )}
                >
                  {selected ? <CheckIcon className="size-3" /> : null}
                </span>
                {label(category)}
              </CommandItem>
            );
          })}
        </CommandList>
      </Command>

      {error ? (
        <p
          id="service-categories-error"
          role="alert"
          className="text-error-deep text-copy-sm"
        >
          {error}
        </p>
      ) : (
        <p
          id="service-categories-hint"
          className="text-muted-foreground text-copy-sm"
        >
          {t("categoriesHint")}
        </p>
      )}
    </div>
  );
}
