"use client";

import { useEffect, useState } from "react";
import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ProductFiltersState } from "./product.types";
import { SearchFilterBar } from "~/components/search-filter-bar";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL = "__all__";

export function ProductFilters({
  filters,
  categories,
  onChange,
}: {
  filters: ProductFiltersState;
  categories: string[];
  onChange: (filters: ProductFiltersState) => void;
}) {
  const t = useTranslations("dashboard.products.filters");
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const search = searchDraft.trim();
      if (search !== filters.search) onChange({ ...filters, search });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [filters, onChange, searchDraft]);

  return (
    <SearchFilterBar
      searchValue={searchDraft}
      onSearchChange={setSearchDraft}
      searchPlaceholder={t("searchPlaceholder")}
    >
      <Select
        value={filters.category || ALL}
        onValueChange={(value) =>
          onChange({ ...filters, category: value === ALL ? "" : value })
        }
      >
        <SelectTrigger
          className="min-h-11 w-full sm:min-h-10 sm:w-48"
          aria-label={t("categoryLabel")}
        >
          <SelectValue placeholder={t("allCategories")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
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
            status: value === "DRAFT" || value === "PUBLISHED" ? value : "",
          })
        }
      >
        <SelectTrigger
          className="min-h-11 w-full sm:min-h-10 sm:w-40"
          aria-label={t("statusLabel")}
        >
          <SelectValue placeholder={t("allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
          <SelectItem value="DRAFT">{t("draft")}</SelectItem>
          <SelectItem value="PUBLISHED">{t("published")}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={filters.lowStockOnly ? "secondary" : "outline"}
        aria-pressed={filters.lowStockOnly}
        className="min-h-11 sm:min-h-10"
        onClick={() =>
          onChange({ ...filters, lowStockOnly: !filters.lowStockOnly })
        }
      >
        <CircleAlertIcon aria-hidden="true" />
        {t("lowStock")}
      </Button>
    </SearchFilterBar>
  );
}
