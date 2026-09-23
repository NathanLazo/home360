"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { usePathname, useRouter } from "~/i18n/navigation";
import {
  DASHBOARD_RANGE_OPTIONS,
  DEFAULT_DASHBOARD_RANGE,
  parseRangeParam,
} from "~/lib/search-params";

/**
 * Date range for the home indicators (`?range=7|30|90`), rendered next to
 * the home's primary action since only the home consumes it.
 */
export function DashboardRangeSelect() {
  const t = useTranslations("dashboard.rangeSelector");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const selected = parseRangeParam({ range: searchParams.get("range") });

  function selectRange(value: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (Number(value) === DEFAULT_DASHBOARD_RANGE) {
      nextSearchParams.delete("range");
    } else {
      nextSearchParams.set("range", value);
    }

    const query = nextSearchParams.toString();
    router.replace(query.length > 0 ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  return (
    <Select value={String(selected)} onValueChange={selectRange}>
      <SelectTrigger aria-label={t("label")} className="w-auto min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent glass align="end">
        <SelectGroup>
          {DASHBOARD_RANGE_OPTIONS.map((days) => (
            <SelectItem key={days} value={String(days)}>
              {t("option", { days })}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
