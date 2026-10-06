"use client";

import { BellIcon, BellOffIcon, RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { NotificationItem } from "./notification-item";
import { useNotifications } from "./use-notifications";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Skeleton } from "~/components/ui/skeleton";

/** Badge caps at 9+: the exact count past that carries no decision. */
const BADGE_CAP = 9;

export function NotificationsBell() {
  const t = useTranslations("dashboard.notifications");
  const errorsT = useTranslations("errors");
  const { feed, isPending, hasError, errorCode, retry, handleOpenChange } =
    useNotifications();
  const unread = feed?.unreadCount ?? 0;
  const badge = unread > BADGE_CAP ? `${BADGE_CAP}+` : String(unread);

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? t("triggerUnread", { count: unread }) : t("trigger")
          }
        >
          <BellIcon aria-hidden="true" />
          {unread > 0 ? (
            <span
              aria-hidden="true"
              className="bg-foreground text-background absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none font-semibold tabular-nums"
            >
              {badge}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        glass
        align="end"
        className="w-[min(22rem,calc(100vw-1.5rem))] p-1"
      >
        <DropdownMenuLabel className="flex items-baseline justify-between gap-2 px-2 py-2">
          <span className="font-medium">{t("title")}</span>
          {unread > 0 ? (
            <span className="text-muted-foreground text-xs font-normal">
              {t("unreadSummary", { count: unread })}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isPending ? (
          <div role="status" className="flex flex-col gap-3 p-2">
            <span className="sr-only">{t("loading")}</span>
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="flex items-start gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-2 px-2 py-3"
          >
            <p className="text-copy-sm font-medium">{t("errorTitle")}</p>
            <p className="text-muted-foreground text-xs">
              {errorCode ? errorsT(errorCode) : t("errorDescription")}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retry}
            >
              <RotateCcwIcon aria-hidden="true" />
              {t("retry")}
            </Button>
          </div>
        ) : !feed || feed.items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <BellOffIcon
              aria-hidden="true"
              className="text-muted-foreground size-5"
            />
            <p className="text-copy-sm font-medium">{t("emptyTitle")}</p>
            <p className="text-muted-foreground text-xs">
              {t("emptyDescription")}
            </p>
          </div>
        ) : (
          <DropdownMenuGroup className="max-h-[min(26rem,70vh)] overflow-y-auto">
            {feed.items.map((item) => (
              <NotificationItem key={item.id} item={item} />
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
