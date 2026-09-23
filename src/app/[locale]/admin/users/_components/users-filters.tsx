"use client";

import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  businessDerivedStatusSchema,
  type BusinessDerivedStatus,
  type UsersTab,
} from "./users.schema";
import { SearchFilterBar } from "~/components/search-filter-bar";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL_STATUSES = "all";

export type UsersFiltersProps = {
  tab: UsersTab;
  search: string;
  onSearchChange: (value: string) => void;
  status: BusinessDerivedStatus | undefined;
  onStatusChange: (status: BusinessDerivedStatus | undefined) => void;
  onExport: () => void;
  exporting: boolean;
};

export function UsersFilters({
  tab,
  search,
  onSearchChange,
  status,
  onStatusChange,
  onExport,
  exporting,
}: UsersFiltersProps) {
  const t = useTranslations("admin.users");
  const statusT = useTranslations("admin.users.derivedStatus");

  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t(`searchPlaceholder.${tab}`)}
    >
      {tab === "businesses" ? (
        <Select
          value={status ?? ALL_STATUSES}
          onValueChange={(value) =>
            onStatusChange(
              value === ALL_STATUSES
                ? undefined
                : businessDerivedStatusSchema.parse(value),
            )
          }
        >
          <SelectTrigger className="min-h-11 w-48 sm:min-h-10">
            <SelectValue aria-label={t("statusFilterLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>{t("allStatuses")}</SelectItem>
            {businessDerivedStatusSchema.options.map((option) => (
              <SelectItem key={option} value={option}>
                {statusT(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="min-h-11 sm:min-h-10"
        disabled={exporting}
        onClick={onExport}
      >
        {exporting ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <DownloadIcon aria-hidden="true" />
        )}
        {t("exportCsv")}
      </Button>
    </SearchFilterBar>
  );
}
