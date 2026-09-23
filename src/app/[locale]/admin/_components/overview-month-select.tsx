"use client";

import { CalendarIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { monthKeyAnchor, recentMonthKeys } from "./overview-months";
import { OVERVIEW_MONTH_OPTIONS } from "./overview.schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export type OverviewMonthSelectProps = {
  /** Month currently reported by the KPIs ("YYYY-MM"). */
  value: string;
  /** Month in course according to the server's financial calendar. */
  currentMonth: string;
  onChange: (month: string | undefined) => void;
};

export function OverviewMonthSelect({
  value,
  currentMonth,
  onChange,
}: OverviewMonthSelectProps) {
  const t = useTranslations("admin.overview.month");
  const formatter = useFormatter();
  const options = recentMonthKeys(currentMonth, OVERVIEW_MONTH_OPTIONS);
  // A deep link to an older month still renders as a selectable option.
  const keys = options.includes(value) ? options : [value, ...options];

  const label = (key: string) => {
    const anchor = monthKeyAnchor(key);
    return t("option", {
      month: formatter.dateTime(anchor, { month: "long", timeZone: "UTC" }),
      year: formatter.dateTime(anchor, { year: "numeric", timeZone: "UTC" }),
    });
  };

  return (
    <Select
      value={value}
      onValueChange={(next) =>
        onChange(next === currentMonth ? undefined : next)
      }
    >
      <SelectTrigger
        className="w-48"
        aria-label={t("label")}
      >
        <CalendarIcon aria-hidden="true" className="text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {keys.map((key) => (
          <SelectItem key={key} value={key}>
            <span className="first-letter:uppercase">{label(key)}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
