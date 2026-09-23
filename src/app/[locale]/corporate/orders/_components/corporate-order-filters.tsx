"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { OrderStatus } from "@generated/prisma";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePathname, useRouter } from "~/i18n/navigation";

const ALL = "__all__";
const ORDER_STATUSES = Object.values(OrderStatus);

export type CorporateOrderFiltersProps = {
  locations: Array<{ id: string; name: string }>;
  locationId?: string;
  status?: OrderStatus;
};

/**
 * Both filters live in the URL (`?location`, `?status`), the same F2-01
 * pattern as the branch selector: the filtered view is shareable and
 * survives a refresh. Invalid values were already normalized by the page.
 */
export function CorporateOrderFilters({
  locations,
  locationId,
  status,
}: CorporateOrderFiltersProps) {
  const t = useTranslations("corporate.orders.filters");
  const statusT = useTranslations("corporate.orderStatus");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: "location" | "status", value: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (value === ALL) {
      nextSearchParams.delete(key);
    } else {
      nextSearchParams.set(key, value);
    }

    const query = nextSearchParams.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  const selectedLocation = locations.some(({ id }) => id === locationId)
    ? locationId
    : ALL;

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select
        value={selectedLocation ?? ALL}
        onValueChange={(value) => setParam("location", value)}
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
      <Select
        value={status ?? ALL}
        onValueChange={(value) => setParam("status", value)}
      >
        <SelectTrigger
          className="w-full sm:w-44"
          aria-label={t("statusLabel")}
        >
          <SelectValue placeholder={t("allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
          {ORDER_STATUSES.map((orderStatus) => (
            <SelectItem key={orderStatus} value={orderStatus}>
              {statusT(orderStatus)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
