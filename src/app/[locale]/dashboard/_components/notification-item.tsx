"use client";

import {
  BadgeCheckIcon,
  BanknoteIcon,
  CircleAlertIcon,
  HandshakeIcon,
  LandmarkIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  TimerResetIcon,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import type { NotificationItem as FeedItem } from "./dashboard.types";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const KIND_ICONS: Record<FeedItem["kind"], LucideIcon> = {
  orderPaid: LockKeyholeIcon,
  quoteAccepted: HandshakeIcon,
  orderConfirmed: BadgeCheckIcon,
  autoReleased: TimerResetIcon,
  disputeOpened: CircleAlertIcon,
  disputeResolved: ShieldCheckIcon,
  withdrawalProcessing: LandmarkIcon,
  withdrawalApproved: BanknoteIcon,
  withdrawalRejected: CircleAlertIcon,
  withdrawalFailed: CircleAlertIcon,
};

const ATTENTION_KINDS = new Set<FeedItem["kind"]>([
  "disputeOpened",
  "withdrawalRejected",
  "withdrawalFailed",
]);

function itemHref(item: FeedItem): string {
  return item.order
    ? `/dashboard/orders?order=${encodeURIComponent(item.order.id)}`
    : "/dashboard/payments";
}

export function NotificationItem({ item }: { item: FeedItem }) {
  const t = useTranslations("dashboard.notifications");
  const formatter = useFormatter();
  // Re-render relative times on the same cadence as the feed poll.
  const now = useNow({ updateInterval: 60_000 });
  const Icon = KIND_ICONS[item.kind];
  const attention = ATTENTION_KINDS.has(item.kind);
  const amount =
    item.amountCents === null
      ? ""
      : formatter.number(item.amountCents / 100, {
          style: "currency",
          currency: "MXN",
        });
  const title = t(`kinds.${item.kind}.title`, {
    folio: item.order?.folio ?? 0,
  });
  const description = t(`kinds.${item.kind}.description`, {
    order: item.order?.title ?? "",
    amount,
  });

  return (
    <DropdownMenuItem asChild className="items-start gap-3 px-2 py-2.5">
      <Link href={itemHref(item)}>
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
            attention
              ? "bg-error-soft text-error-deep"
              : "bg-canvas-soft-2 text-foreground",
          )}
        >
          <Icon className="size-4 text-current" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate font-medium">{title}</span>
            <time
              dateTime={item.createdAt.toISOString()}
              className="text-muted-foreground shrink-0 text-xs"
            >
              {formatter.relativeTime(item.createdAt, now)}
            </time>
          </span>
          <span className="text-muted-foreground line-clamp-2 text-xs">
            {description}
          </span>
        </span>
        {item.unread ? (
          <span className="bg-link mt-2 size-2 shrink-0 rounded-full">
            <span className="sr-only">{t("unread")}</span>
          </span>
        ) : null}
      </Link>
    </DropdownMenuItem>
  );
}
