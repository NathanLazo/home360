"use client";

import { Maximize2Icon, Minimize2Icon, MinusIcon, XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { useAgentDock } from "./agent-dock-context";
import { AgentChat } from "~/components/agent/agent-chat";
import { Button } from "~/components/ui/button";
import { SPRING_PANEL } from "~/lib/ease";
import { cn } from "~/lib/utils";

/**
 * A floating chat anchored to the bottom-right corner of the panel, above
 * the footer. It stays mounted while minimized so the conversation and its
 * stream survive; only the visible one takes pointer events and focus.
 */
export function AgentDockBubble({ chatKey }: { chatKey: string }) {
  const t = useTranslations("agent.dock");
  const reduce = useReducedMotion() ?? false;
  const {
    area,
    readOnly,
    available,
    chats,
    activeKey,
    expanded,
    minimizeChat,
    closeChat,
    setChatTitle,
    toggleExpanded,
  } = useAgentDock();
  const title = chats.find((chat) => chat.key === chatKey)?.title ?? null;
  const isActive = activeKey === chatKey;
  const label = title ?? t("newChat");
  const hidden = reduce
    ? { opacity: 0, transitionEnd: { visibility: "hidden" as const } }
    : {
        opacity: 0,
        y: 16,
        scale: 0.97,
        transitionEnd: { visibility: "hidden" as const },
      };

  return (
    <motion.section
      role="dialog"
      aria-label={label}
      aria-hidden={!isActive}
      inert={!isActive}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
      animate={
        isActive
          ? { opacity: 1, y: 0, scale: 1, visibility: "visible" }
          : hidden
      }
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
      transition={reduce ? { duration: 0.15 } : SPRING_PANEL}
      style={{ transformOrigin: "bottom right" }}
      className={cn(
        "border-border bg-popover text-popover-foreground absolute right-3 bottom-11 z-40 flex flex-col overflow-hidden rounded-lg border shadow-lg",
        "transition-[width,height] duration-250 ease-out motion-reduce:transition-none",
        expanded
          ? "h-[calc(100%-4.25rem)] w-[min(42rem,calc(100%-1.5rem))]"
          : "h-[min(32rem,calc(100%-4.25rem))] w-[min(26rem,calc(100%-1.5rem))]",
        !isActive && "pointer-events-none",
      )}
    >
      <AgentChat
        area={area}
        readOnly={readOnly}
        available={available}
        variant="dock"
        onTitleChange={(next) => setChatTitle(chatKey, next)}
        headerStart={
          <p className="min-w-0 truncate text-[0.8125rem] font-medium">
            {label}
          </p>
        }
        headerEnd={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={t("minimize")}
              title={t("minimize")}
              onClick={() => minimizeChat(chatKey)}
            >
              <MinusIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={expanded ? t("collapse") : t("expand")}
              title={expanded ? t("collapse") : t("expand")}
              onClick={toggleExpanded}
            >
              {expanded ? (
                <Minimize2Icon className="size-3.5" />
              ) : (
                <Maximize2Icon className="size-3.5" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={t("close")}
              title={t("close")}
              onClick={() => closeChat(chatKey)}
            >
              <XIcon className="size-3.5" />
            </Button>
          </>
        }
      />
    </motion.section>
  );
}
