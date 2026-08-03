"use client";

import { CheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { OrderDetail } from "./order.types";

type TimelineItem = {
  key: "created" | "paid" | "released" | "completed" | "cancelled" | "disputed";
  date: Date | null;
};

export function OrderTimeline({ order }: { order: OrderDetail }) {
  const t = useTranslations("dashboard.orders.timeline");
  const formatter = useFormatter();
  const items: TimelineItem[] = [{ key: "created", date: order.createdAt }];

  if (order.payment) {
    items.push({ key: "paid", date: order.payment.createdAt });
    if (order.payment.releasedAt) {
      items.push({ key: "released", date: order.payment.releasedAt });
    }
  }

  if (order.status === "COMPLETED") {
    items.push({ key: "completed", date: null });
  } else if (order.status === "CANCELLED") {
    items.push({ key: "cancelled", date: null });
  } else if (order.status === "DISPUTED") {
    items.push({ key: "disputed", date: null });
  }

  return (
    <ol className="space-y-0" aria-label={t("label")}>
      {items.map((item, index) => (
        <li
          key={`${item.key}-${item.date?.toISOString() ?? "current"}`}
          className="flex gap-3"
        >
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full">
              <CheckIcon className="size-3.5" strokeWidth={2} />
            </span>
            {index < items.length - 1 ? (
              <span className="bg-border min-h-10 w-px flex-1" />
            ) : null}
          </div>
          <div className="min-w-0 pb-5">
            <p className="text-sm font-medium">{t(item.key)}</p>
            {item.date ? (
              <time
                dateTime={item.date.toISOString()}
                className="text-muted-foreground text-xs"
              >
                {formatter.dateTime(item.date, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
