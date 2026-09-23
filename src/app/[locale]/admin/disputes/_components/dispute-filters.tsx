"use client";

import { useTranslations } from "next-intl";

import {
  DISPUTE_FILTERS,
  DISPUTE_SEARCH_MAX_LENGTH,
  disputeFilterSchema,
  disputeUrgencyFilterSchema,
  type DisputeFilter,
} from "./disputes.schema";
import { DisputeUrgency } from "@generated/prisma";
import { SearchFilterBar } from "~/components/search-filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL_URGENCIES = "all";

/** Status, urgency and free-text search over the dispute queue. */
export function DisputeFilters({
  status,
  urgency,
  search,
  onStatusChange,
  onUrgencyChange,
  onSearchChange,
}: {
  status: DisputeFilter;
  urgency: DisputeUrgency | null;
  search: string;
  onStatusChange: (status: DisputeFilter) => void;
  onUrgencyChange: (urgency: DisputeUrgency | null) => void;
  onSearchChange: (search: string) => void;
}) {
  const t = useTranslations("admin.disputes.filters");
  const urgencyT = useTranslations("admin.disputeUrgency");

  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={(value) =>
        onSearchChange(value.slice(0, DISPUTE_SEARCH_MAX_LENGTH))
      }
      searchPlaceholder={t("searchPlaceholder")}
    >
      <Select
        value={status}
        onValueChange={(value) =>
          onStatusChange(disputeFilterSchema.parse(value))
        }
      >
        <SelectTrigger
          className="min-h-11 w-44 sm:min-h-10"
          aria-label={t("statusLabel")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DISPUTE_FILTERS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`status.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={urgency ?? ALL_URGENCIES}
        onValueChange={(value) =>
          onUrgencyChange(
            value === ALL_URGENCIES
              ? null
              : disputeUrgencyFilterSchema.parse(value),
          )
        }
      >
        <SelectTrigger
          className="min-h-11 w-40 sm:min-h-10"
          aria-label={t("urgencyLabel")}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_URGENCIES}>{t("allUrgencies")}</SelectItem>
          {Object.values(DisputeUrgency).map((option) => (
            <SelectItem key={option} value={option}>
              {urgencyT(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SearchFilterBar>
  );
}
