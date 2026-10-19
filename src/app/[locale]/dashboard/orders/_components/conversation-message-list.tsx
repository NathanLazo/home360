"use client";

import { useEffect, useRef } from "react";
import { useFormatter, useTranslations } from "next-intl";

import type { ConversationMessage } from "./use-order-conversation";
import { cn } from "~/lib/utils";

/**
 * Read-only thread. Messages not sent by the customer belong to the business
 * side (owner or assigned worker) and align to the end.
 */
export function OrderMessageList({
  messages,
  customerId,
}: {
  messages: ConversationMessage[];
  customerId: string;
}) {
  const t = useTranslations("dashboard.orders.conversation");
  const formatter = useFormatter();
  const endRef = useRef<HTMLLIElement>(null);
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lastId]);

  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground text-copy-sm py-6 text-center">
        {t("empty")}
      </p>
    );
  }

  return (
    <ol
      className="flex max-h-80 flex-col gap-2 overflow-y-auto overscroll-contain p-1"
      aria-label={t("threadLabel")}
      aria-live="polite"
    >
      {messages.map((message, index) => {
        const fromCustomer = message.senderId === customerId;

        return (
          <li
            key={message.id}
            ref={index === messages.length - 1 ? endRef : undefined}
            className={cn(
              "flex max-w-[85%] flex-col gap-1",
              fromCustomer ? "self-start" : "items-end self-end",
            )}
          >
            <span className="sr-only">
              {t(fromCustomer ? "fromCustomer" : "fromBusiness")}
            </span>
            <p
              className={cn(
                "text-copy-sm rounded-md px-3 py-2 break-words whitespace-pre-wrap",
                fromCustomer ? "bg-canvas-soft border" : "bg-ink text-on-ink",
              )}
            >
              {message.type === "TEXT"
                ? (message.body ?? "")
                : t(
                    message.type === "IMAGE"
                      ? "imageMessage"
                      : "locationMessage",
                  )}
            </p>
            <time
              dateTime={message.createdAt.toISOString()}
              className="text-muted-foreground text-xs tabular-nums"
            >
              {formatter.dateTime(message.createdAt, {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
