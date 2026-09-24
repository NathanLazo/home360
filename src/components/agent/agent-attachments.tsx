"use client";

import { useId } from "react";
import { PaperclipIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import {
  AttachmentUpload,
  type AttachmentUploadItem,
} from "~/components/motion/attachment-upload";
import { Button } from "~/components/motion/button";
import { cn } from "~/lib/utils";

import {
  AGENT_ATTACHMENT_ACCEPT,
  AGENT_ATTACHMENT_MAX_FILES,
  AGENT_ATTACHMENT_MAX_SIZE,
} from "./agent-chat.files";

export type AgentAttachmentsProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AttachmentUploadItem[];
  onItemsChange: (items: AttachmentUploadItem[]) => void;
  disabled?: boolean;
};

/**
 * Paperclip trigger plus the upload panel that pops above the composer. The
 * panel grows from its bottom-left corner (the trigger) and collapses back;
 * under reduced motion it only fades.
 */
export function AgentAttachments({
  open,
  onOpenChange,
  items,
  onItemsChange,
  disabled = false,
}: AgentAttachmentsProps) {
  const t = useTranslations("agent.attachments");
  const reduce = useReducedMotion() ?? false;
  const panelId = useId();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          items.length > 0
            ? t("openWithCount", { count: items.length })
            : t("open")
        }
        aria-expanded={open}
        aria-controls={panelId}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className={cn("relative shrink-0", open && "bg-muted text-foreground")}
      >
        <PaperclipIcon className="size-4" />
        {items.length > 0 ? (
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full text-[10px] leading-none font-medium tabular-nums"
          >
            {items.length}
          </span>
        ) : null}
      </Button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="attachments"
            id={panelId}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, transform: "translateY(6px) scale(0.98)" }
            }
            animate={
              reduce
                ? { opacity: 1 }
                : { opacity: 1, transform: "translateY(0px) scale(1)" }
            }
            exit={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, transform: "translateY(6px) scale(0.98)" }
            }
            transition={
              reduce
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 420, damping: 34 }
            }
            style={{ transformOrigin: "0% 100%" }}
            className="absolute inset-x-0 bottom-full z-10 mb-2"
          >
            <AttachmentUpload
              value={items}
              onValueChange={onItemsChange}
              accept={AGENT_ATTACHMENT_ACCEPT}
              maxFiles={AGENT_ATTACHMENT_MAX_FILES}
              maxFileSize={AGENT_ATTACHMENT_MAX_SIZE}
              disabled={disabled}
              title={t("dropTitle")}
              description={t("dropDescription")}
              attachmentsLabel={t("label")}
              labels={{
                uploadComplete: t("uploadComplete"),
                uploadCompleteFor: (name) => t("uploadCompleteFor", { name }),
                removing: t("removing"),
                uploadFailed: t("uploadFailed"),
                uploadFailedFor: (name) => t("uploadFailedFor", { name }),
                retry: t("retry"),
                remove: t("remove"),
                limitReached: t("limitReached"),
                limitSummary: (count, max) => t("limitSummary", { count, max }),
                web: t("web"),
              }}
              className="bg-card shadow-float rounded-2xl"
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
