"use client";

import { useTranslations } from "next-intl";

import type { QuotableService } from "./order.types";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

/** Radix Select forbids "" as an item value: sentinel for "no service". */
const NO_SERVICE = "none";

/**
 * Optional catalog service of the offer. A service with diagnostic turns the
 * offer into a two-step charge (diagnostic now, final charge after visit).
 */
export function OfferServiceField({
  id,
  value,
  services,
  disabled,
  describedBy,
  onChange,
}: {
  id: string;
  value: string;
  services: QuotableService[];
  disabled: boolean;
  describedBy?: string;
  onChange: (serviceId: string) => void;
}) {
  const t = useTranslations("dashboard.requests.offerForm");

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("serviceLabel")}</Label>
      <Select
        value={value === "" ? NO_SERVICE : value}
        onValueChange={(next) => onChange(next === NO_SERVICE ? "" : next)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          aria-describedby={describedBy}
        >
          <SelectValue placeholder={t("servicePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_SERVICE}>{t("serviceNone")}</SelectItem>
          {services.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              {service.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
