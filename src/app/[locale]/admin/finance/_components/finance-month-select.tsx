"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const MONTH_OPTIONS = 12;

/** "YYYY-MM" of `offset` months before `now`, in UTC calendar terms. */
function monthKey(now: Date, offset: number): string {
  const anchor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 15, 12),
  );
  return anchor.toISOString().slice(0, 7);
}

/**
 * W12 period selector: the last twelve months, current first. The value is
 * the "YYYY-MM" key that `getKpis` / `getRevenueBreakdown` accept.
 */
export function FinanceMonthSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (month: string) => void;
}) {
  const t = useTranslations("admin.finance.month");
  const formatter = useFormatter();
  // Frozen on mount so the option list never shifts under the pointer.
  const [options] = useState(() => {
    const now = new Date();
    return Array.from({ length: MONTH_OPTIONS }, (_, index) =>
      monthKey(now, index),
    );
  });
  const current = options[0] ?? "";
  const selected = value ?? current;
  const all = options.includes(selected) ? options : [selected, ...options];

  return (
    <Select value={selected} onValueChange={onChange}>
      <SelectTrigger
        className="min-h-11 w-48 sm:min-h-10"
        aria-label={t("label")}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {all.map((month) => (
          <SelectItem key={month} value={month}>
            {month === current
              ? t("current", {
                  month: formatter.dateTime(
                    new Date(`${month}-15T12:00:00.000Z`),
                    {
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    },
                  ),
                })
              : formatter.dateTime(new Date(`${month}-15T12:00:00.000Z`), {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
