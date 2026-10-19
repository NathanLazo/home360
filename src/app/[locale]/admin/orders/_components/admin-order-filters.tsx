"use client";

import { useTranslations } from "next-intl";

import {
  ADMIN_ORDER_STATUSES,
  ADMIN_ORDER_TYPES,
  adminOrderStatusSchema,
  adminOrderTypeSchema,
  type AdminOrderStatusValue,
  type AdminOrderTypeValue,
} from "./admin-orders.schema";
import { SearchFilterBar } from "~/components/search-filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL = "all";

/** Search (folio, title, customer, business) plus status and type. */
export function AdminOrderFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  onClearFilters,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  status: AdminOrderStatusValue | undefined;
  onStatusChange: (status: AdminOrderStatusValue | undefined) => void;
  type: AdminOrderTypeValue | undefined;
  onTypeChange: (type: AdminOrderTypeValue | undefined) => void;
  onClearFilters: () => void;
}) {
  const t = useTranslations("admin.orders");
  const statusT = useTranslations("admin.orderStatus");
  const activeCount = [status, type].filter(Boolean).length;

  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("searchPlaceholder")}
      activeCount={activeCount}
      onClearFilters={onClearFilters}
    >
      <Select
        value={status ?? ALL}
        onValueChange={(value) => {
          const parsed = adminOrderStatusSchema.safeParse(value);
          onStatusChange(parsed.success ? parsed.data : undefined);
        }}
      >
        <SelectTrigger className="w-44" aria-label={t("statusFilterLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
          {ADMIN_ORDER_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {statusT(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={type ?? ALL}
        onValueChange={(value) => {
          const parsed = adminOrderTypeSchema.safeParse(value);
          onTypeChange(parsed.success ? parsed.data : undefined);
        }}
      >
        <SelectTrigger className="w-40" aria-label={t("typeFilterLabel")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allTypes")}</SelectItem>
          {ADMIN_ORDER_TYPES.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`types.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SearchFilterBar>
  );
}
