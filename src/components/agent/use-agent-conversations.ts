"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { toErrorCode } from "~/lib/trpc-errors";
import type { AgentUIMessage } from "~/server/agent/home360-agent";
import { api } from "~/trpc/react";

import type { AgentConversationListItem } from "./agent-conversation-menu";

const TITLE_MAX_CHARS = 60;

/** First user text of the thread, trimmed to a menu-friendly length. */
export function deriveConversationTitle(
  messages: AgentUIMessage[],
  fallback: string,
): string {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const texts: string[] = [];

  for (const part of firstUserMessage?.parts ?? []) {
    if (part.type === "text") {
      texts.push(part.text);
    }
  }

  return truncateConversationTitle(texts.join(" "), fallback);
}

/** Menu-friendly title from free text (first prompt of a thread). */
export function truncateConversationTitle(
  value: string,
  fallback: string,
): string {
  const text = value.trim();

  if (!text) {
    return fallback;
  }

  return text.length > TITLE_MAX_CHARS
    ? `${text.slice(0, TITLE_MAX_CHARS).trimEnd()}…`
    : text;
}

/**
 * Persisted snapshots are written by this same client, so an array is the
 * only shape we need to guard against before handing it to `useChat`.
 */
function toUIMessages(value: unknown): AgentUIMessage[] {
  return Array.isArray(value) ? (value as AgentUIMessage[]) : [];
}

/**
 * Thread persistence over tRPC (`agent` router). The list is cached by React
 * Query; every write invalidates it so the menu and other tabs stay in sync.
 * Failures surface as translated toasts and never interrupt the chat.
 */
export function useAgentConversations() {
  const utils = api.useUtils();
  const errors = useTranslations("errors");
  const listQuery = api.agent.listConversations.useQuery(undefined, {
    staleTime: 30_000,
  });
  const createMutation = api.agent.createConversation.useMutation();
  const updateMutation = api.agent.updateConversation.useMutation();
  const deleteMutation = api.agent.deleteConversation.useMutation();

  const conversations: AgentConversationListItem[] =
    listQuery.data?.error === null ? (listQuery.data.result ?? []) : [];

  const invalidate = useCallback(
    () => utils.agent.listConversations.invalidate(),
    [utils],
  );

  const load = useCallback(
    async (id: string): Promise<AgentUIMessage[] | null> => {
      try {
        const response = await utils.agent.getConversation.fetch({ id });

        if (response.error !== null || response.result === null) {
          return null;
        }

        return toUIMessages(response.result.messages);
      } catch {
        return null;
      }
    },
    [utils],
  );

  const create = useCallback(
    async (
      title: string,
      messages: AgentUIMessage[],
    ): Promise<string | null> => {
      try {
        const response = await createMutation.mutateAsync({ title, messages });

        if (response.error !== null || response.result === null) {
          toast.error(errors(response.error ?? "UNKNOWN_ERROR"));
          return null;
        }

        await invalidate();
        return response.result.id;
      } catch (error: unknown) {
        toast.error(errors(toErrorCode(error)));
        return null;
      }
    },
    [createMutation, errors, invalidate],
  );

  const update = useCallback(
    async (id: string, messages: AgentUIMessage[]): Promise<boolean> => {
      try {
        const response = await updateMutation.mutateAsync({ id, messages });

        if (response.error !== null) {
          toast.error(errors(response.error));
          return false;
        }

        await invalidate();
        return true;
      } catch (error: unknown) {
        toast.error(errors(toErrorCode(error)));
        return false;
      }
    },
    [errors, invalidate, updateMutation],
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const response = await deleteMutation.mutateAsync({ id });

        if (response.error !== null) {
          toast.error(errors(response.error));
          return false;
        }

        await invalidate();
        return true;
      } catch (error: unknown) {
        toast.error(errors(toErrorCode(error)));
        return false;
      }
    },
    [deleteMutation, errors, invalidate],
  );

  return {
    conversations,
    isLoading: listQuery.isPending,
    load,
    create,
    update,
    remove,
  };
}
