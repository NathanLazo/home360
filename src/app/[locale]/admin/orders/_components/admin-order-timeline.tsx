"use client";

import { CheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { AdminOrderEvent } from "./admin-orders.types";

/** Order event log, oldest first, with actor and note (D10-14). */
export function AdminOrderTimeline({
  createdAt,
  events,
}: {
  createdAt: Date;
  events: AdminOrderEvent[];
}) {
  const t = useTranslations("admin.orders.timeline");
  const formatter = useFormatter();
  const items = [
    {
      id: "created",
      label: t("created"),
      date: createdAt,
      actorName: null,
      note: null,
      noteIsReason: false,
    },
    ...events.map((event) => ({
      id: event.id,
      label: t(`events.${event.type}`),
      date: event.createdAt,
      actorName: event.actorName,
      note: event.note,
      noteIsReason: event.type === "CANCELLED",
    })),
  ];

  return (
    <ol aria-label={t("label")}>
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center" aria-hidden="true">
            <span className="bg-ink text-on-ink flex size-6 shrink-0 items-center justify-center rounded-full">
              <CheckIcon className="size-3.5" strokeWidth={2} />
            </span>
            {index < items.length - 1 ? (
              <span className="bg-hairline min-h-8 w-px flex-1" />
            ) : null}
          </div>
          <div className="min-w-0 space-y-0.5 pb-4">
            <p className="text-copy-sm font-medium">{item.label}</p>
            <p className="text-muted-foreground text-xs">
              <time dateTime={item.date.toISOString()} suppressHydrationWarning>
                {formatter.dateTime(item.date, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
              {item.actorName ? (
                <span>{t("byActor", { name: item.actorName })}</span>
              ) : null}
            </p>
            {item.note ? (
              <p className="text-muted-foreground text-copy-sm break-words whitespace-pre-wrap">
                {t(item.noteIsReason ? "reason" : "note", { note: item.note })}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
