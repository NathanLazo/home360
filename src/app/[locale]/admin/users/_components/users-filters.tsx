"use client";

import { DownloadIcon, LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { UsersFilterSelect } from "./users-filter-select";
import {
  businessDerivedStatusSchema,
  userAccessStatusSchema,
  workerAvailabilitySchema,
  type BusinessDerivedStatus,
  type UserAccessStatus,
  type UsersTab,
  type WorkerAvailabilityValue,
} from "./users.schema";
import { SearchFilterBar } from "~/components/search-filter-bar";
import { Button } from "~/components/ui/button";

export type UsersFiltersProps = {
  tab: UsersTab;
  search: string;
  onSearchChange: (value: string) => void;
  status: BusinessDerivedStatus | undefined;
  onStatusChange: (status: BusinessDerivedStatus | undefined) => void;
  accessStatus: UserAccessStatus | undefined;
  onAccessStatusChange: (status: UserAccessStatus | undefined) => void;
  availability: WorkerAvailabilityValue | undefined;
  onAvailabilityChange: (
    availability: WorkerAvailabilityValue | undefined,
  ) => void;
  onExport: () => void;
  exporting: boolean;
};

export function UsersFilters({
  tab,
  search,
  onSearchChange,
  status,
  onStatusChange,
  accessStatus,
  onAccessStatusChange,
  availability,
  onAvailabilityChange,
  onExport,
  exporting,
}: UsersFiltersProps) {
  const t = useTranslations("admin.users");
  const statusT = useTranslations("admin.users.derivedStatus");
  const accessT = useTranslations("admin.users.accessStatus");
  const availabilityT = useTranslations("admin.workerAvailability");

  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={t(`searchPlaceholder.${tab}`)}
    >
      {tab === "businesses" ? (
        <UsersFilterSelect
          value={status}
          options={businessDerivedStatusSchema.options}
          parse={(value) => businessDerivedStatusSchema.parse(value)}
          optionLabel={(option) => statusT(option)}
          allLabel={t("allStatuses")}
          ariaLabel={t("statusFilterLabel")}
          onChange={onStatusChange}
        />
      ) : null}

      {tab === "customers" ? (
        <UsersFilterSelect
          value={accessStatus}
          options={userAccessStatusSchema.options}
          parse={(value) => userAccessStatusSchema.parse(value)}
          optionLabel={(option) => accessT(option)}
          allLabel={t("allStatuses")}
          ariaLabel={t("statusFilterLabel")}
          onChange={onAccessStatusChange}
        />
      ) : null}

      {tab === "workers" ? (
        <UsersFilterSelect
          value={availability}
          options={Object.values(workerAvailabilitySchema.enum)}
          parse={(value) => workerAvailabilitySchema.parse(value)}
          optionLabel={(option) => availabilityT(option)}
          allLabel={t("allAvailabilities")}
          ariaLabel={t("availabilityFilterLabel")}
          onChange={onAvailabilityChange}
        />
      ) : null}

      <Button
        type="button"
        variant="outline"
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
