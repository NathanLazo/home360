"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePathname, useRouter } from "~/i18n/navigation";
import { api } from "~/trpc/react";

const CURRENT = "__current__";
const ALL = "__all__";
const MONTHS_BACK = 12;

/** "YYYY-MM" keys for the current month and the previous eleven. */
function recentMonthKeys(now: Date): string[] {
  return Array.from({ length: MONTHS_BACK }, (_, offset) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 15),
    );
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");

    return `${date.getUTCFullYear()}-${month}`;
  });
}

function monthKeyToDate(key: string): Date {
  const [year, month] = key.split("-").map(Number);

  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, 15));
}

export type OverviewFiltersProps = {
  month?: string;
  locationId?: string;
};

/**
 * Month and location filters of the overview. Both live in the URL
 * (`?month`, `?location`), the same F2-01 pattern as the orders filters, so
 * the view is shareable and the sidebar carries `location` across sections.
 */
export function OverviewFilters({ month, locationId }: OverviewFiltersProps) {
  const t = useTranslations("corporate.home.filters");
  const formatter = useFormatter();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationsQuery = api.corporate.listLocations.useQuery({
    includeInactive: true,
  });
  const locations = locationsQuery.data?.result?.items ?? [];
  const monthKeys = useMemo(() => recentMonthKeys(new Date()), []);
  const currentKey = monthKeys[0];

  function setParam(key: "month" | "location", value: string | null) {
    const next = new URLSearchParams(searchParams.toString());

    if (value === null) {
      next.delete(key);
    } else {
      next.set(key, value);
    }

    const query = next.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const selectedMonth =
    month !== undefined && month !== currentKey ? month : CURRENT;
  const selectedLocation = locations.some(({ id }) => id === locationId)
    ? (locationId ?? ALL)
    : ALL;

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select
        value={selectedMonth}
        onValueChange={(value) =>
          setParam("month", value === CURRENT ? null : value)
        }
      >
        <SelectTrigger
          className="w-full sm:w-52"
          aria-label={t("monthLabel")}
        >
          <SelectValue placeholder={t("currentMonth")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CURRENT}>{t("currentMonth")}</SelectItem>
          {monthKeys.slice(1).map((key) => (
            <SelectItem key={key} value={key}>
              {formatter.dateTime(monthKeyToDate(key), {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </SelectItem>
          ))}
          {month !== undefined && !monthKeys.includes(month) ? (
            <SelectItem value={month}>
              {formatter.dateTime(monthKeyToDate(month), {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      <Select
        value={selectedLocation}
        onValueChange={(value) =>
          setParam("location", value === ALL ? null : value)
        }
      >
        <SelectTrigger
          className="w-full sm:w-56"
          aria-label={t("locationLabel")}
        >
          <SelectValue placeholder={t("allLocations")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allLocations")}</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
