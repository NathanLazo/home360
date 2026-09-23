"use client";

import { CheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { OrderDetail } from "./order.types";

type TimelineItem = {
  id: string;
  label: string;
  date: Date | null;
  actorName: string | null;
  note: string | null;
};

type ReconstructedKey =
  "created" | "paid" | "released" | "completed" | "cancelled" | "disputed";

/**
 * Legacy/seed orders have no OrderEvent rows: rebuild the milestones from the
 * order and payment timestamps instead of showing an empty log.
 */
function reconstructTimeline(
  order: OrderDetail,
): Array<{ key: ReconstructedKey; date: Date | null }> {
  const items: Array<{ key: ReconstructedKey; date: Date | null }> = [
    { key: "created", date: order.createdAt },
  ];

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

  return items;
}

export function OrderTimeline({ order }: { order: OrderDetail }) {
  const t = useTranslations("dashboard.orders.timeline");
  const formatter = useFormatter();

  const items: TimelineItem[] =
    order.events.length > 0
      ? [
          {
            id: "created",
            label: t("created"),
            date: order.createdAt,
            actorName: null,
            note: null,
          },
          ...order.events.map((event) => ({
            id: event.id,
            label: t(`events.${event.type}`),
            date: event.createdAt,
            actorName: event.actorName,
            note: event.note,
          })),
        ]
      : reconstructTimeline(order).map((item) => ({
          id: `${item.key}-${item.date?.toISOString() ?? "current"}`,
          label: t(item.key),
          date: item.date,
          actorName: null,
          note: null,
        }));

  return (
    <ol className="space-y-0" aria-label={t("label")}>
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className="bg-ink text-on-ink flex size-6 shrink-0 items-center justify-center rounded-full">
              <CheckIcon className="size-3.5" strokeWidth={2} />
            </span>
            {index < items.length - 1 ? (
              <span className="bg-hairline min-h-10 w-px flex-1" />
            ) : null}
          </div>
          <div className="min-w-0 space-y-0.5 pb-5">
            <p className="text-copy-sm font-medium">{item.label}</p>
            {item.date ? (
              <p className="text-muted-foreground text-xs">
                <time dateTime={item.date.toISOString()}>
                  {formatter.dateTime(item.date, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
                {item.actorName ? (
                  <span>{t("byActor", { name: item.actorName })}</span>
                ) : null}
              </p>
            ) : null}
            {item.note ? (
              <p className="text-muted-foreground text-copy-sm break-words whitespace-pre-wrap">
                {t("note", { note: item.note })}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
