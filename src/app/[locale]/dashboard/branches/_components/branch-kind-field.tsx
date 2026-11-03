"use client";

import { StoreIcon, WarehouseIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BranchKindValue } from "./branch.types";
import { cn } from "~/lib/utils";

const KIND_OPTIONS: ReadonlyArray<{
  value: BranchKindValue;
  icon: LucideIcon;
  key: "store" | "warehouse";
}> = [
  { value: "STORE", icon: StoreIcon, key: "store" },
  { value: "WAREHOUSE", icon: WarehouseIcon, key: "warehouse" },
];

/**
 * F11 location kind: native radios (arrow keys, form semantics) styled as a
 * two-card segmented choice. Fixed after creation, so editing shows it locked.
 */
export function BranchKindField({
  value,
  locked,
  disabled,
  onChange,
}: {
  value: BranchKindValue;
  locked: boolean;
  disabled: boolean;
  onChange: (kind: BranchKindValue) => void;
}) {
  const t = useTranslations("dashboard.branches.form.kind");

  return (
    <fieldset
      className="grid gap-2"
      aria-describedby={locked ? "branch-kind-locked" : undefined}
    >
      <legend className="mb-2 text-sm leading-none font-medium">
        {t("legend")}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        {KIND_OPTIONS.map(({ value: option, icon: Icon, key }) => {
          const checked = value === option;

          return (
            <label
              key={option}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-[border-color,background-color,box-shadow] duration-150 ease-out motion-reduce:transition-none",
                "has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2",
                checked
                  ? "border-foreground bg-muted/60 shadow-sm"
                  : "hover:border-hairline-strong",
                (locked || disabled) && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="branch-kind"
                value={option}
                checked={checked}
                disabled={locked || disabled}
                onChange={() => onChange(option)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-medium">
                <Icon aria-hidden="true" className="size-4" />
                {t(`${key}.label`)}
              </span>
              <span className="text-muted-foreground text-copy-sm">
                {t(`${key}.help`)}
              </span>
            </label>
          );
        })}
      </div>
      {locked ? (
        <p
          id="branch-kind-locked"
          className="text-muted-foreground text-copy-sm"
        >
          {t("locked")}
        </p>
      ) : null}
    </fieldset>
  );
}
