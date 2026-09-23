"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  WITHDRAWAL_HISTORY_STATUSES,
  withdrawalHistoryStatusSchema,
} from "./finance.schema";
import type { WithdrawalHistoryFilters as Filters } from "./finance.types";
import { SearchFilterBar } from "~/components/search-filter-bar";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL_STATUSES = "all";

/** History-only filters: status, business name and requested-date range. */
export function WithdrawalHistoryFilters({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const t = useTranslations("admin.finance.withdrawals.history");
  const statusT = useTranslations("admin.withdrawalStatus");
  const fieldId = useId();

  return (
    <div className="flex flex-col gap-3">
      <SearchFilterBar
        searchValue={filters.business}
        onSearchChange={(business) => onChange({ ...filters, business })}
        searchPlaceholder={t("businessPlaceholder")}
      >
        <Select
          value={filters.status ?? ALL_STATUSES}
          onValueChange={(value) =>
            onChange({
              ...filters,
              status:
                value === ALL_STATUSES
                  ? null
                  : withdrawalHistoryStatusSchema.parse(value),
            })
          }
        >
          <SelectTrigger
            className="w-44"
            aria-label={t("statusLabel")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t("allStatuses")}</SelectItem>
            {WITHDRAWAL_HISTORY_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {statusT(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SearchFilterBar>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-from`} className="text-xs">
            {t("from")}
          </Label>
          <Input
            id={`${fieldId}-from`}
            type="date"
            className="w-44"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) =>
              onChange({ ...filters, from: event.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${fieldId}-to`} className="text-xs">
            {t("to")}
          </Label>
          <Input
            id={`${fieldId}-to`}
            type="date"
            className="w-44"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) =>
              onChange({ ...filters, to: event.target.value })
            }
          />
        </div>
      </div>
    </div>
  );
}
