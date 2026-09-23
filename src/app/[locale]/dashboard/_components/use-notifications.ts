"use client";

import { useRef } from "react";

import { api } from "~/trpc/react";

/** The bell polls: the feed is derived server-side, there is no push channel. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Feed query + "mark as seen". Opening the menu marks the feed seen on the
 * server but keeps the unread dots of the current snapshot visible until the
 * menu closes, so the owner can still tell which items are new.
 */
export function useNotifications() {
  const utils = api.useUtils();
  const query = api.dashboard.getNotifications.useQuery(undefined, {
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
  const markSeen = api.dashboard.markNotificationsSeen.useMutation();
  const markedWhileOpen = useRef(false);

  const feed = query.data?.result ?? null;
  const responseError = query.data?.error ?? null;

  function handleOpenChange(open: boolean) {
    if (open) {
      if (feed && feed.unreadCount > 0) {
        markedWhileOpen.current = true;
        markSeen.mutate();
      }
      return;
    }

    if (markedWhileOpen.current) {
      markedWhileOpen.current = false;
      void utils.dashboard.getNotifications.invalidate();
    }
  }

  return {
    feed,
    isPending: query.isPending,
    hasError: Boolean(query.error ?? responseError),
    errorCode: responseError,
    retry: () => void query.refetch(),
    handleOpenChange,
  };
}
