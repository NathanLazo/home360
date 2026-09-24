"use client";

import { useState, type ReactNode } from "react";
import { isToolUIPart } from "ai";
import { ChevronRightIcon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ThinkingOrbGlyph } from "~/components/agents/loading-states/thinking-orb";
import { ThinkingShimmer } from "~/components/agents/loading-states/thinking-shimmer";
import {
  Message,
  MessageAvatar,
  MessageBubble,
  MessageBubbleContent,
  MessageContent,
} from "~/components/agents/message";
import { StreamingResponse } from "~/components/agents/streaming-response";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";
import type { AgentUIMessage } from "~/server/agent/home360-agent";

import { AgentMarkdown } from "./agent-markdown";
import { deriveAgentActivity } from "./agent-orb-state";
import { AgentToolChips } from "./agent-tool-part";

type AgentPart = AgentUIMessage["parts"][number];

type PartSegment =
  | { kind: "text"; part: AgentPart; index: number }
  | { kind: "tools"; parts: AgentPart[]; index: number };

/** Consecutive tool parts render as one chip row instead of stacked cards. */
function segmentParts(parts: AgentPart[]): PartSegment[] {
  const segments: PartSegment[] = [];

  for (const [index, part] of parts.entries()) {
    if (isToolUIPart(part)) {
      const last = segments[segments.length - 1];

      if (last?.kind === "tools") {
        last.parts.push(part);
      } else {
        segments.push({ kind: "tools", parts: [part], index });
      }
    } else {
      segments.push({ kind: "text", part, index });
    }
  }

  return segments;
}

function AgentActivitySection({
  toolCount,
  autoOpen,
  children,
}: {
  toolCount: number;
  autoOpen: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("agent.activitySection");
  // null = untouched: follows the automatic state (open while working).
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? autoOpen;

  return (
    <Collapsible open={open} onOpenChange={setManualOpen} className="w-full">
      <CollapsibleTrigger
        className="bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        aria-label={t("toggleLabel")}
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        {t("title", { count: toolCount })}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 flex w-full flex-col gap-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export type AgentMessageProps = {
  message: AgentUIMessage;
  isLast: boolean;
  isStreaming: boolean;
};

export function AgentMessage({ message, isLast, isStreaming }: AgentMessageProps) {
  const t = useTranslations("agent");
  const responseLabels = {
    copy: t("response.copy"),
    copied: t("response.copied"),
    retry: t("response.retry"),
    helpful: t("response.helpful"),
    notHelpful: t("response.notHelpful"),
  };

  if (message.role === "user") {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join("");
    const files = message.parts.filter((part) => part.type === "file");

    return (
      <Message from="user" animateIn>
        <MessageContent>
          {files.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-2">
              {files.map((file, index) =>
                file.mediaType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL attachment
                  <img
                    key={`${message.id}-file-${index}`}
                    src={file.url}
                    alt={file.filename ?? t("attachedImage")}
                    className="max-h-40 rounded-xl border object-cover"
                  />
                ) : (
                  <span
                    key={`${message.id}-file-${index}`}
                    className="bg-muted/60 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
                  >
                    <FileTextIcon className="size-3.5" aria-hidden="true" />
                    {file.filename ?? t("attachedFile")}
                  </span>
                ),
              )}
            </div>
          ) : null}
          {text ? (
            <MessageBubble>
              <MessageBubbleContent>{text}</MessageBubbleContent>
            </MessageBubble>
          ) : null}
        </MessageContent>
      </Message>
    );
  }

  const streaming = isLast && isStreaming;
  const activity = deriveAgentActivity(message.parts, streaming);
  const activityLabel = t(`activity.${activity.labelKey}`);
  const hasVisibleParts = message.parts.some(
    (part) =>
      (part.type === "text" && part.text.trim().length > 0) ||
      isToolUIPart(part),
  );

  const segments = segmentParts(message.parts);
  const lastSegment = segments[segments.length - 1];
  const hasFinalAnswer =
    lastSegment?.kind === "text" &&
    lastSegment.part.type === "text" &&
    lastSegment.part.text.trim().length > 0;
  const answerSegment = hasFinalAnswer ? lastSegment : null;
  const activitySegments = hasFinalAnswer ? segments.slice(0, -1) : segments;
  const activityToolCount = activitySegments.reduce(
    (count, segment) =>
      segment.kind === "tools" ? count + segment.parts.length : count,
    0,
  );

  const renderSegment = (segment: PartSegment) => {
    if (segment.kind === "tools") {
      return (
        <AgentToolChips
          key={`${message.id}-tools-${segment.index}`}
          parts={segment.parts}
        />
      );
    }

    const part = segment.part;

    // Reasoning, step-start and source parts are not rendered on purpose.
    if (part.type !== "text" || !part.text.trim()) {
      return null;
    }

    return (
      <StreamingResponse
        key={`${message.id}-text-${segment.index}`}
        status={streaming ? "streaming" : "complete"}
        copyText={part.text}
        showActions={!streaming}
        announce={false}
        labels={responseLabels}
        className="w-full"
      >
        <AgentMarkdown>{part.text}</AgentMarkdown>
      </StreamingResponse>
    );
  };

  return (
    <Message from="assistant" animateIn>
      <MessageAvatar className="bg-transparent" aria-label={t("assistantLabel")}>
        <ThinkingOrbGlyph
          state={activity.state}
          size={20}
          paused={!streaming}
          decorative
          className="size-5"
        />
      </MessageAvatar>
      <MessageContent className="gap-2">
        {!hasVisibleParts && streaming ? (
          <ThinkingShimmer>{activityLabel}</ThinkingShimmer>
        ) : null}
        {activityToolCount > 0 ? (
          <AgentActivitySection
            toolCount={activityToolCount}
            autoOpen={!hasFinalAnswer}
          >
            {activitySegments.map(renderSegment)}
          </AgentActivitySection>
        ) : (
          activitySegments.map(renderSegment)
        )}
        {answerSegment ? renderSegment(answerSegment) : null}
        {hasVisibleParts && streaming && activity.state !== "composing" ? (
          <ThinkingShimmer>{activityLabel}</ThinkingShimmer>
        ) : null}
      </MessageContent>
    </Message>
  );
}

export function AgentPendingMessage() {
  const t = useTranslations("agent");

  return (
    <Message from="assistant" animateIn aria-label={t("connectingLabel")}>
      <MessageAvatar className="bg-transparent">
        <ThinkingOrbGlyph
          state="connecting"
          size={20}
          decorative
          className="size-5"
        />
      </MessageAvatar>
      <MessageContent>
        <ThinkingShimmer>{t("activity.connecting")}</ThinkingShimmer>
      </MessageContent>
    </Message>
  );
}
