"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

/** Inclusive creation-date range for the order list (native date inputs). */
export function OrderDateFilter({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const t = useTranslations("dashboard.orders.filters");
  const fromId = useId();
  const toId = useId();
  const inverted = from !== "" && to !== "" && from > to;

  return (
    <fieldset className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
      <legend className="sr-only">{t("dateRangeLabel")}</legend>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fromId} className="text-muted-foreground text-xs">
          {t("fromLabel")}
        </Label>
        <Input
          id={fromId}
          type="date"
          value={from}
          max={to || undefined}
          onChange={(event) => onChange({ from: event.target.value, to })}
          className="sm:w-44"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={toId} className="text-muted-foreground text-xs">
          {t("toLabel")}
        </Label>
        <Input
          id={toId}
          type="date"
          value={to}
          min={from || undefined}
          aria-invalid={inverted || undefined}
          onChange={(event) => onChange({ from, to: event.target.value })}
          className="sm:w-44"
        />
      </div>
      {from !== "" || to !== "" ? (
        <Button
          type="button"
          variant="ghost"
          className="self-start sm:self-auto"
          onClick={() => onChange({ from: "", to: "" })}
        >
          <XIcon aria-hidden="true" />
          {t("clearDates")}
        </Button>
      ) : null}
      {inverted ? (
        <p
          role="alert"
          className="text-destructive text-copy-sm sm:self-center"
        >
          {t("invalidRange")}
        </p>
      ) : null}
    </fieldset>
  );
}
