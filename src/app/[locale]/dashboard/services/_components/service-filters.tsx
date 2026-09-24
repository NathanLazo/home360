"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { ServiceFiltersState } from "./service.types";
import { SearchFilterBar } from "~/components/search-filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL = "__all__";

function toStatus(value: string): ServiceFiltersState["status"] {
  return value === "ACTIVE" || value === "PAUSED" ? value : "";
}

export function ServiceFilters({
  filters,
  categories,
  onChange,
}: {
  filters: ServiceFiltersState;
  categories: string[];
  onChange: (filters: ServiceFiltersState) => void;
}) {
  const t = useTranslations("dashboard.services");
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchDraft !== filters.search) {
        onChange({ ...filters, search: searchDraft.trim() });
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [filters, onChange, searchDraft]);

  return (
    <SearchFilterBar
      searchValue={searchDraft}
      onSearchChange={setSearchDraft}
      searchPlaceholder={t("filters.searchPlaceholder")}
      activeCount={
        [filters.category, filters.status].filter((value) => value !== "")
          .length
      }
      onClearFilters={() => onChange({ ...filters, category: "", status: "" })}
    >
      <Select
        value={filters.category || ALL}
        onValueChange={(value) =>
          onChange({ ...filters, category: value === ALL ? "" : value })
        }
      >
        <SelectTrigger
          className="w-full sm:w-48"
          aria-label={t("filters.categoryLabel")}
        >
          <SelectValue placeholder={t("filters.allCategories")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("filters.allCategories")}</SelectItem>
          {categories.map((category) => (
            <SelectItem key={category} value={category}>
              {category}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.status || ALL}
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: value === ALL ? "" : toStatus(value),
          })
        }
      >
        <SelectTrigger
          className="w-full sm:w-40"
          aria-label={t("filters.statusLabel")}
        >
          <SelectValue placeholder={t("filters.allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
          <SelectItem value="ACTIVE">{t("status.ACTIVE")}</SelectItem>
          <SelectItem value="PAUSED">{t("status.PAUSED")}</SelectItem>
        </SelectContent>
      </Select>
    </SearchFilterBar>
  );
}
