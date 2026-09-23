"use client";

import { useFormatter, useTranslations } from "next-intl";

import type { CorporateOrderDetail } from "./corporate-requests.types";

export type CorporateOrderTimelineProps = {
  events: CorporateOrderDetail["timeline"];
};

/** Chronological order events (C6 timeline, read-only for the account). */
export function CorporateOrderTimeline({
  events,
}: CorporateOrderTimelineProps) {
  const t = useTranslations("corporate.orders.detail");
  const eventT = useTranslations("corporate.orderEvent");
  const formatter = useFormatter();

  if (events.length === 0) {
    return (
      <p className="text-muted-foreground text-copy-sm">{t("noEvents")}</p>
    );
  }

  return (
    <ol className="flex flex-col gap-3 border-l pl-4">
      {events.map((event) => (
        <li key={event.id} className="relative flex flex-col gap-0.5">
          <span
            aria-hidden="true"
            className="bg-ink absolute top-1.5 -left-[1.3rem] size-2 rounded-full"
          />
          <span className="text-copy-sm font-medium">{eventT(event.type)}</span>
          <time
            dateTime={event.createdAt.toISOString()}
            className="text-muted-foreground text-xs tabular-nums"
          >
            {formatter.dateTime(event.createdAt, {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </li>
      ))}
    </ol>
  );
}
