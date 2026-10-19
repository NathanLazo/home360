"use client";

import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { OrderMessageComposer } from "./order-message-composer";
import { OrderMessageList } from "./order-message-list";
import { useOrderConversation } from "./use-order-conversation";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

/** Customer chat of the order, embedded in the detail sheet. */
export function OrderConversationPanel({
  orderId,
  customerId,
  customerName,
}: {
  orderId: string;
  customerId: string;
  customerName: string;
}) {
  const t = useTranslations("dashboard.orders.conversation");
  const errorsT = useTranslations("errors");
  const conversation = useOrderConversation(orderId, true);
  const { state } = conversation;

  return (
    <section
      id="order-conversation"
      aria-labelledby="order-conversation-heading"
      className="space-y-3 rounded-xl border p-4"
    >
      <div className="space-y-0.5">
        <h3
          id="order-conversation-heading"
          className="text-copy-sm font-medium"
        >
          {t("title", { name: customerName })}
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

      {state.status === "error" ? (
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
        <OrderMessageList messages={state.messages} customerId={customerId} />
      ) : null}

      <OrderMessageComposer
        sending={conversation.sending}
        disabled={state.status !== "ready"}
        onSend={conversation.send}
      />
    </section>
  );
}
