"use client";

import { useEffect, useRef, useState } from "react";

import type { TranslatableErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api, type RouterOutputs } from "~/trpc/react";

const POLL_INTERVAL_MS = 10_000;

export type ConversationMessage = NonNullable<
  RouterOutputs["messaging"]["listMessages"]["result"]
>["items"][number];

export type OrderConversationState =
  | { status: "pending" }
  | { status: "error"; code: TranslatableErrorCode }
  | { status: "ready"; messages: ConversationMessage[] };

/**
 * Opens (or creates) the order conversation once the panel is shown and polls
 * its messages every ~10 s. Real time on web is out of scope: the persisted
 * `Message` rows rule, as on mobile.
 */
export function useOrderConversation(orderId: string, enabled: boolean) {
  const utils = api.useUtils();
  const openMutation = api.messaging.getOrCreateConversation.useMutation();
  const sendMutation = api.messaging.send.useMutation();
  const markReadMutation = api.messaging.markRead.useMutation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<TranslatableErrorCode | null>(
    null,
  );
  const [attempt, setAttempt] = useState(0);
  const requestedFor = useRef<string | null>(null);
  const { mutateAsync: openConversation } = openMutation;

  useEffect(() => {
    const key = `${orderId}:${attempt}`;
    if (!enabled || requestedFor.current === key) return;
    requestedFor.current = key;
    setConversationId(null);
    setOpenError(null);

    openConversation({ orderId })
      .then((response) => {
        if (response.result) setConversationId(response.result.conversationId);
        else setOpenError(response.error ?? "UNKNOWN_ERROR");
      })
      .catch((error: unknown) => setOpenError(toErrorCode(error)));
  }, [enabled, orderId, attempt, openConversation]);

  const messagesQuery = api.messaging.listMessages.useQuery(
    { conversationId: conversationId ?? "" },
    {
      enabled: enabled && conversationId !== null,
      refetchInterval: POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
    },
  );

  const newestId = messagesQuery.data?.result?.items[0]?.id ?? null;
  const { mutate: markRead } = markReadMutation;

  useEffect(() => {
    if (conversationId && newestId) markRead({ conversationId });
  }, [conversationId, newestId, markRead]);

  function retry() {
    if (openError !== null) {
      setAttempt((current) => current + 1);
      return;
    }

    void messagesQuery.refetch();
  }

  async function send(body: string): Promise<TranslatableErrorCode | null> {
    if (!conversationId) return "NOT_FOUND";

    try {
      const response = await sendMutation.mutateAsync({
        conversationId,
        type: "TEXT",
        body,
      });

      if (response.error !== null) return response.error;
      await utils.messaging.listMessages.invalidate({ conversationId });
      return null;
    } catch (error) {
      return toErrorCode(error);
    }
  }

  let state: OrderConversationState;
  const response = messagesQuery.data;

  if (openError !== null) {
    state = { status: "error", code: openError };
  } else if (!conversationId || messagesQuery.isPending) {
    state = { status: "pending" };
  } else if (messagesQuery.error) {
    state = { status: "error", code: toErrorCode(messagesQuery.error) };
  } else if (response?.error != null || !response?.result) {
    state = { status: "error", code: response?.error ?? "UNKNOWN_ERROR" };
  } else {
    // The API pages newest-first; the thread reads oldest-first.
    state = { status: "ready", messages: [...response.result.items].reverse() };
  }

  return {
    state,
    send,
    sending: sendMutation.isPending,
    retry,
  };
}
