"use client";

import type { ReactNode } from "react";
import { SlidersHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { FilterDrawer } from "~/components/filter-drawer";
import { SearchInput } from "~/components/search-input";

export type SearchFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  /**
   * Filters other than the search. Inline on `sm+`; on phones they live in a
   * bottom drawer behind a "Filters" button so the list stays above the fold.
   */
  children?: ReactNode;
  /** Number of non-search filters currently applied; shown on the button. */
  activeCount?: number;
  /** Clears every non-search filter; shown in the drawer when provided. */
  onClearFilters?: () => void;
};

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  children,
  activeCount = 0,
  onClearFilters,
}: SearchFilterBarProps) {
  const t = useTranslations("common.filters");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <SearchInput
          value={searchValue}
          onValueChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1"
        />
        {children ? (
          <FilterDrawer
            activeCount={activeCount}
            onClear={onClearFilters}
            triggerClassName="sm:hidden"
            triggerIcon={<SlidersHorizontalIcon aria-hidden="true" />}
            triggerLabel={t("open")}
          >
            {children}
          </FilterDrawer>
        ) : null}
      </div>
      {children ? (
        <div className="hidden flex-wrap items-center gap-2 sm:flex">
          {children}
        </div>
      ) : null}
    </div>
  );
}
