"use client";

import { useTranslations } from "next-intl";

import type { OrderFiltersState, OrderListItem } from "./order.types";
import { SearchFilterBar } from "~/components/search-filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL = "__all__";
const ORDER_STATUSES: OrderListItem["status"][] = [
  "PENDING",
  "PAID",
  "IN_PROGRESS",
  "SHIPPING",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
];

export function OrderFilters({
  filters,
  searchDraft,
  onSearchChange,
  onChange,
}: {
  filters: OrderFiltersState;
  searchDraft: string;
  onSearchChange: (search: string) => void;
  onChange: (filters: OrderFiltersState) => void;
}) {
  const t = useTranslations("dashboard.orders.filters");
  const statusT = useTranslations("dashboard.orderStatus");

  return (
    <SearchFilterBar
      searchValue={searchDraft}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("searchPlaceholder")}
    >
      <Select
        value={filters.status === "" ? ALL : filters.status}
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: ORDER_STATUSES.find((status) => status === value) ?? "",
          })
        }
      >
        <SelectTrigger
          className="min-h-11 w-full sm:min-h-10 sm:w-44"
          aria-label={t("statusLabel")}
        >
          <SelectValue placeholder={t("allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
          {ORDER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {statusT(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.type === "" ? ALL : filters.type}
        onValueChange={(value) =>
          onChange({
            ...filters,
            type: value === "SERVICE" || value === "PRODUCT" ? value : "",
          })
        }
      >
        <SelectTrigger
          className="min-h-11 w-full sm:min-h-10 sm:w-40"
          aria-label={t("typeLabel")}
        >
          <SelectValue placeholder={t("allTypes")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
          <SelectItem value="SERVICE">{t("service")}</SelectItem>
          <SelectItem value="PRODUCT">{t("product")}</SelectItem>
        </SelectContent>
      </Select>
    </SearchFilterBar>
  );
}
