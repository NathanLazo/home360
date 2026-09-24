"use client";

import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  PinIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

export type AgentConversationListItem = {
  id: string;
  title: string;
  updatedAt: Date;
};

const PINS_STORAGE_KEY = "home360.agent.pins";

function readPins(): Set<string> {
  try {
    const raw = window.localStorage.getItem(PINS_STORAGE_KEY);

    if (!raw) {
      return new Set();
    }

    const parsed: unknown = JSON.parse(raw);

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function writePins(pins: Set<string>) {
  try {
    window.localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify([...pins]));
  } catch {
    // Storage unavailable: pins stay session-only.
  }
}

type GroupKey = "pinned" | "today" | "yesterday" | "thisWeek" | "older";

const GROUP_ORDER: GroupKey[] = [
  "pinned",
  "today",
  "yesterday",
  "thisWeek",
  "older",
];

function dateGroup(date: Date): GroupKey {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.floor(
    (startOfDay(new Date()) - startOfDay(date)) / 86_400_000,
  );

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "thisWeek";
  return "older";
}

export type AgentConversationMenuProps = {
  conversations: AgentConversationListItem[];
  activeId: string | null;
  disabled?: boolean;
  onNewConversation: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Thread history as a dropdown: pinned first (kept per browser), then today,
 * yesterday, this week and older. Hovering or focusing a row swaps its
 * timestamp for the pin and delete actions.
 */
export function AgentConversationMenu({
  conversations,
  activeId,
  disabled,
  onNewConversation,
  onSelect,
  onDelete,
}: AgentConversationMenuProps) {
  const t = useTranslations("agent.conversations");
  const format = useFormatter();
  const active = conversations.find((item) => item.id === activeId);
  const [pins, setPins] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPins(readPins());
  }, []);

  const togglePin = (id: string) => {
    setPins((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      writePins(next);
      return next;
    });
  };

  const grouped = new Map<GroupKey, AgentConversationListItem[]>();

  for (const conversation of conversations) {
    const group = pins.has(conversation.id)
      ? "pinned"
      : dateGroup(conversation.updatedAt);
    const entries = grouped.get(group);

    if (entries) {
      entries.push(conversation);
    } else {
      grouped.set(group, [conversation]);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="max-w-[14rem] justify-start gap-1 px-2 md:max-w-xs"
        >
          <span className="truncate">{active?.title ?? t("new")}</span>
          <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-2">
        <DropdownMenuItem
          onSelect={onNewConversation}
          className="gap-2 rounded-lg py-2"
        >
          <MessageSquarePlusIcon className="size-4" />
          {t("new")}
        </DropdownMenuItem>
        {conversations.length > 0 ? <DropdownMenuSeparator /> : null}
        <div className="max-h-80 overflow-y-auto">
          {GROUP_ORDER.filter((group) => grouped.has(group)).map((group) => (
            <div key={group} className="not-first:mt-2">
              <p className="text-muted-foreground/70 px-2 pb-1 font-mono text-[9.5px] font-medium tracking-[0.08em] uppercase">
                {t(`groups.${group}`)}
              </p>
              {(grouped.get(group) ?? []).map((conversation) => {
                const isActive = conversation.id === activeId;
                const pinned = pins.has(conversation.id);

                return (
                  <DropdownMenuItem
                    key={conversation.id}
                    onSelect={() => onSelect(conversation.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "group/item gap-2 rounded-lg py-2 transition-[background-color,transform] duration-150 active:scale-[0.99] motion-reduce:transition-none",
                      isActive && "bg-accent text-accent-foreground",
                    )}
                  >
                    <MessageSquareIcon
                      aria-hidden="true"
                      className={cn(
                        "size-3.5 shrink-0",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground/50",
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[12.5px]",
                        isActive
                          ? "text-foreground font-medium"
                          : "text-muted-foreground",
                      )}
                    >
                      {conversation.title}
                    </span>
                    <span
                      className={cn(
                        "text-muted-foreground shrink-0 text-xs tabular-nums group-focus-within/item:hidden group-hover/item:hidden",
                        pinned && "hidden",
                      )}
                    >
                      {format.relativeTime(conversation.updatedAt)}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 items-center gap-0.5",
                        pinned
                          ? "flex"
                          : "hidden group-focus-within/item:flex group-hover/item:flex",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={
                          pinned
                            ? t("unpin", { title: conversation.title })
                            : t("pin", { title: conversation.title })
                        }
                        aria-pressed={pinned}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          togglePin(conversation.id);
                        }}
                        className={cn(
                          "grid size-6 place-items-center rounded-md transition-[color,transform] duration-150 active:scale-[0.9] motion-reduce:transition-none",
                          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                          pinned
                            ? "text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <PinIcon
                          className={cn("size-3", pinned && "fill-current")}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={t("delete", { title: conversation.title })}
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          onDelete(conversation.id);
                        }}
                        className={cn(
                          "text-muted-foreground hover:text-destructive grid size-6 place-items-center rounded-md transition-[color,transform] duration-150 active:scale-[0.9] motion-reduce:transition-none",
                          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                          pinned &&
                            "hidden group-focus-within/item:grid group-hover/item:grid",
                        )}
                      >
                        <Trash2Icon className="size-3" />
                      </button>
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
