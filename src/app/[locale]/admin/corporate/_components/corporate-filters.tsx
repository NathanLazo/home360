"use client";

import { useTranslations } from "next-intl";

import {
  corporateTierSchema,
  type CorporateTierValue,
} from "./corporate.schema";
import { SearchFilterBar } from "~/components/search-filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL_TIERS = "all";

export type CorporateFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  tier: CorporateTierValue | undefined;
  onTierChange: (tier: CorporateTierValue | undefined) => void;
};

/**
 * Search plus tier filter. Status is not repeated here: the tabs above the
 * table already are the status filter, and both live in the URL.
 */
export function CorporateFilters({
  search,
  onSearchChange,
  tier,
  onTierChange,
}: CorporateFiltersProps) {
  const t = useTranslations("admin.corporate");
  const tierT = useTranslations("admin.corporate.tier");

  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t("searchPlaceholder")}
    >
      <Select
        value={tier ?? ALL_TIERS}
        onValueChange={(value) =>
          onTierChange(
            value === ALL_TIERS ? undefined : corporateTierSchema.parse(value),
          )
        }
      >
        <SelectTrigger className="min-h-11 w-48 sm:min-h-10">
          <SelectValue aria-label={t("tierFilterLabel")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TIERS}>{t("allTiers")}</SelectItem>
          {corporateTierSchema.options.map((option) => (
            <SelectItem key={option} value={option}>
              {tierT(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SearchFilterBar>
  );
}
