"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type {
  PaymentMethodValue,
  PaymentStatusValue,
  TransactionFiltersState,
} from "./payment.types";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const ALL = "__all__";

const PAYMENT_STATUSES: PaymentStatusValue[] = [
  "PENDING",
  "IN_ESCROW",
  "RELEASING",
  "RELEASED",
  "REFUNDING",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
];

const PAYMENT_METHODS: PaymentMethodValue[] = [
  "CARD",
  "TRANSFER",
  "PAYMENT_LINK",
];

export const EMPTY_TRANSACTION_FILTERS: TransactionFiltersState = {
  status: "",
  method: "",
};

export function TransactionFilters({
  filters,
  onChange,
}: {
  filters: TransactionFiltersState;
  onChange: (filters: TransactionFiltersState) => void;
}) {
  const t = useTranslations("dashboard.payments.filters");
  const statusT = useTranslations("dashboard.payments.status");
  const methodT = useTranslations("dashboard.payments.methods");
  const active = filters.status !== "" || filters.method !== "";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Select
        value={filters.status === "" ? ALL : filters.status}
        onValueChange={(value) =>
          onChange({
            ...filters,
            status: PAYMENT_STATUSES.find((status) => status === value) ?? "",
          })
        }
      >
        <SelectTrigger
          className="min-h-11 w-full sm:min-h-10 sm:w-48"
          aria-label={t("statusLabel")}
        >
          <SelectValue placeholder={t("allStatuses")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allStatuses")}</SelectItem>
          {PAYMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {statusT(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.method === "" ? ALL : filters.method}
        onValueChange={(value) =>
          onChange({
            ...filters,
            method: PAYMENT_METHODS.find((method) => method === value) ?? "",
          })
        }
      >
        <SelectTrigger
          className="min-h-11 w-full sm:min-h-10 sm:w-44"
          aria-label={t("methodLabel")}
        >
          <SelectValue placeholder={t("allMethods")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("allMethods")}</SelectItem>
          {PAYMENT_METHODS.map((method) => (
            <SelectItem key={method} value={method}>
              {methodT(method)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active ? (
        <Button
          type="button"
          variant="ghost"
          className="self-start sm:self-auto"
          onClick={() => onChange(EMPTY_TRANSACTION_FILTERS)}
        >
          <XIcon aria-hidden="true" />
          {t("clear")}
        </Button>
      ) : null}
    </div>
  );
}
