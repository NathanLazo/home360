"use client";

import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ConversationMessageComposer } from "./conversation-message-composer";
import { ConversationMessageList } from "./conversation-message-list";
import { useConversation, type ConversationSource } from "./use-conversation";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * Customer chat embedded in a detail sheet: the order thread or the
 * pre-sale thread of a request (same list, composer and polling).
 * `notFoundHint` replaces the generic error when the server answers
 * NOT_FOUND because the thread is not open to this business yet.
 */
export function ConversationPanel({
  id,
  source,
  customerId,
  title,
  notFoundHint,
}: {
  id: string;
  source: ConversationSource;
  customerId: string;
  title: string;
  notFoundHint?: string;
}) {
  const t = useTranslations("dashboard.orders.conversation");
  const errorsT = useTranslations("errors");
  const conversation = useConversation(source, true);
  const { state } = conversation;
  const headingId = `${id}-heading`;
  const unavailable =
    state.status === "error" &&
    state.code === "NOT_FOUND" &&
    notFoundHint !== undefined;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="space-y-3 rounded-xl border p-4"
    >
      <div className="space-y-0.5">
        <h3 id={headingId} className="text-copy-sm font-medium">
          {title}
        </h3>
        <p className="text-muted-foreground text-xs">{t("pollingHint")}</p>
      </div>

      {state.status === "pending" ? (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only">{t("loading")}</span>
          <Skeleton className="h-9 w-3/5 rounded-md" />
          <Skeleton className="ml-auto h-9 w-2/5 rounded-md" />
          <Skeleton className="h-9 w-1/2 rounded-md" />
        </div>
      ) : null}

      {unavailable ? (
        <p className="text-muted-foreground text-copy-sm bg-canvas-soft rounded-md p-3">
          {notFoundHint}
        </p>
      ) : null}

      {state.status === "error" && !unavailable ? (
        <div role="alert" className="flex flex-col items-start gap-2">
          <p className="text-muted-foreground text-copy-sm">
            {errorsT(state.code)}
          </p>
          <Button type="button" variant="outline" onClick={conversation.retry}>
            <RotateCcwIcon aria-hidden="true" />
            {t("retry")}
          </Button>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <ConversationMessageList
          messages={state.messages}
          customerId={customerId}
        />
      ) : null}

      {unavailable ? null : (
        <ConversationMessageComposer
          sending={conversation.sending}
          disabled={state.status !== "ready"}
          onSend={conversation.send}
        />
      )}
    </section>
  );
}
