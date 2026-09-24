"use client";

import { HistoryIcon, SparklesIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { useAgentDock } from "./agent-dock-context";
import { Button } from "~/components/ui/button";
import { Link } from "~/i18n/navigation";
import { AGENT_AREA_PATH } from "~/lib/agent/agent-area";
import { SPRING_LAYOUT } from "~/lib/ease";
import { cn } from "~/lib/utils";

/**
 * The footer lane of the assistant: one pill per open chat (click to raise
 * or minimize its bubble), the "Agent" entry point and the link to the full
 * conversation history. Pills glide into place with the shared layout
 * spring; reduced motion swaps them without travel.
 */
export function AgentDockBar() {
  const t = useTranslations("agent.dock");
  const reduce = useReducedMotion() ?? false;
  const { area, chats, activeKey, openNewChat, focusChat, minimizeChat } =
    useAgentDock();
  const transition = reduce ? { duration: 0.15 } : SPRING_LAYOUT;

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex min-w-0 items-center gap-1.5"
    >
      <ul
        aria-label={t("chats")}
        className="flex min-w-0 [scrollbar-width:none] items-center gap-1.5 overflow-x-auto"
      >
        <AnimatePresence initial={false}>
          {chats.map((chat) => {
            const isActive = chat.key === activeKey;
            const title = chat.title ?? t("newChat");

            return (
              <motion.li
                key={chat.key}
                layout={!reduce}
                initial={
                  reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.92 }
                }
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={
                  reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.92 }
                }
                transition={transition}
                className="shrink-0"
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  title={title}
                  onClick={() =>
                    isActive ? minimizeChat(chat.key) : focusChat(chat.key)
                  }
                  className={cn(
                    "border-border focus-visible:ring-ring rounded-pill inline-flex h-6 max-w-44 items-center gap-1.5 border px-2.5 text-xs transition-colors duration-150 ease-out outline-none focus-visible:ring-2 motion-reduce:transition-none",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      isActive
                        ? "bg-metal shadow-hairline"
                        : "bg-hairline-strong",
                    )}
                  />
                  <span className="truncate">{title}</span>
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openNewChat}
        className="text-muted-foreground hover:text-foreground h-7 shrink-0 gap-1.5 px-2"
      >
        <SparklesIcon aria-hidden="true" className="size-3.5" />
        {t("open")}
      </Button>
      <Button
        asChild
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <Link
          href={AGENT_AREA_PATH[area]}
          aria-label={t("history")}
          title={t("history")}
        >
          <HistoryIcon aria-hidden="true" className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}
