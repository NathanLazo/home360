"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MessageSquarePlusIcon } from "lucide-react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { ChatApp } from "~/components/agents/chat-app";
import { ThinkingOrbGlyph } from "~/components/agents/loading-states/thinking-orb";
import { MessageScroller } from "~/components/agents/message-scroller";
import {
  PromptInput,
  type PromptModel,
} from "~/components/agents/prompt-input";
import {
  UsageMeter,
  UsageRing,
  type UsageState,
} from "~/components/agents/usage-meter";
import type { AttachmentUploadItem } from "~/components/motion/attachment-upload";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Link } from "~/i18n/navigation";
import { agentProfileBillingHref, type AgentArea } from "~/lib/agent/agent-area";
import {
  AGENT_MODELS,
  DEFAULT_AGENT_MODEL_ID,
  getAgentModel,
  isAgentModelId,
  type AgentModelId,
} from "~/lib/agent/agent-models";
import {
  formatUsdMicros,
  turnCostUsdMicros,
} from "~/lib/agent/agent-pricing";
import { EASE_OUT, SPRING_LAYOUT } from "~/lib/ease";
import { cn } from "~/lib/utils";
import type { AgentUIMessage } from "~/server/agent/home360-agent";

import { AgentAttachments } from "./agent-attachments";
import { attachmentsToFileParts } from "./agent-chat.files";
import { AgentConversationMenu } from "./agent-conversation-menu";
import { AgentMessage, AgentPendingMessage } from "./agent-message";
import { deriveAgentOrbState } from "./agent-orb-state";
import {
  deriveConversationTitle,
  truncateConversationTitle,
  useAgentConversations,
} from "./use-agent-conversations";

const FADE_TRANSITION = { duration: 0.2, ease: EASE_OUT } as const;

const MODEL_STORAGE_KEY = "home360.agent.model";
const THREAD_PARAM = "thread";

/** The chat route answers 402 with this code when the wallet is empty. */
const CREDIT_REQUIRED_CODE = "AI_CREDIT_REQUIRED";

function readStoredModel(): AgentModelId {
  try {
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
    return stored && isAgentModelId(stored) ? stored : DEFAULT_AGENT_MODEL_ID;
  } catch {
    return DEFAULT_AGENT_MODEL_ID;
  }
}

/** The active thread lives in the URL so a reload or a shared link reopens it. */
function writeThreadParam(id: string | null) {
  const url = new URL(window.location.href);

  if (id) {
    url.searchParams.set(THREAD_PARAM, id);
  } else {
    url.searchParams.delete(THREAD_PARAM);
  }

  window.history.replaceState(window.history.state, "", url);
}

export type AgentChatProps = {
  area: AgentArea;
  /** True while an admin impersonates: writes are refused server-side. */
  readOnly: boolean;
  /** False when the gateway key is missing: the composer explains it. */
  available: boolean;
  /**
   * `page` fills the assistant route and mirrors the thread in the URL;
   * `dock` fits a floating bubble: fixed header row, no URL writes.
   */
  variant?: "page" | "dock";
  /** Dock only: the bubble mirrors the conversation title in its pill. */
  onTitleChange?: (title: string) => void;
  /** Dock only: leading content of the header row (the bubble title). */
  headerStart?: ReactNode;
  /** Dock only: trailing controls of the header row (minimize, close…). */
  headerEnd?: ReactNode;
};

export function AgentChat({
  area,
  readOnly,
  available,
  variant = "page",
  onTitleChange,
  headerStart,
  headerEnd,
}: AgentChatProps) {
  const t = useTranslations("agent");
  const locale = useLocale();
  const reduce = useReducedMotion() ?? false;
  // Consumption tier next to each model (owner decision F8-05): free / low / high.
  const modelOptions = useMemo<PromptModel[]>(
    () =>
      AGENT_MODELS.map((option) => ({
        value: option.id,
        label: (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{option.label}</span>
            <Badge
              variant="secondary"
              className="shrink-0 px-1.5 py-0 text-[10px] leading-4"
            >
              {t(`models.tier.${option.tier}`)}
            </Badge>
          </span>
        ),
      })),
    [t],
  );
  const searchParams = useSearchParams();
  const threads = useAgentConversations();
  const isDock = variant === "dock";
  const [input, setInput] = useState("");
  // The server renders the default; the stored preference applies on mount.
  const [model, setModel] = useState<AgentModelId>(DEFAULT_AGENT_MODEL_ID);
  const [attachments, setAttachments] = useState<AttachmentUploadItem[]>([]);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(() =>
    isDock ? null : searchParams.get(THREAD_PARAM),
  );
  const syncThreadParam = (id: string | null) => {
    if (!isDock) {
      writeThreadParam(id);
    }
  };
  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/agent/chat" }),
  );
  const activeIdRef = useRef<string | null>(activeId);
  // useChat captures its callbacks at creation, so persistence goes via a ref.
  const persistRef = useRef<(messages: AgentUIMessage[]) => void>(
    () => undefined,
  );
  const { messages, sendMessage, status, stop, error, setMessages } =
    useChat<AgentUIMessage>({
      transport,
      onFinish: ({ messages: finished }) => {
        persistRef.current(finished);
      },
    });

  const newConversationTitle = t("conversations.new");

  useEffect(() => {
    setModel(readStoredModel());
  }, []);

  // Restore the thread named in the URL once (useChat state resets on unmount).
  useEffect(() => {
    const restoreId = activeIdRef.current;

    if (!restoreId) {
      return;
    }

    let cancelled = false;

    void threads.load(restoreId).then((restored) => {
      if (cancelled) {
        return;
      }

      if (restored) {
        setMessages(restored);
      } else {
        activeIdRef.current = null;
        setActiveId(null);
        syncThreadParam(null);
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const selectModel = (next: string) => {
    if (!isAgentModelId(next)) {
      return;
    }

    setModel(next);

    try {
      window.localStorage.setItem(MODEL_STORAGE_KEY, next);
    } catch {
      // Preference stays for this session only.
    }
  };

  persistRef.current = (finished) => {
    if (finished.length === 0 || readOnly) {
      return;
    }

    void (async () => {
      const currentId = activeIdRef.current;

      if (!currentId) {
        const derivedTitle = deriveConversationTitle(
          finished,
          newConversationTitle,
        );
        const createdId = await threads.create(derivedTitle, finished);

        if (createdId) {
          activeIdRef.current = createdId;
          setActiveId(createdId);
          syncThreadParam(createdId);
          onTitleChange?.(derivedTitle);
        }
      } else {
        await threads.update(currentId, finished);
      }
    })();
  };

  const isBusy = status === "submitted" || status === "streaming";

  const hasConversation = messages.length > 0;
  const lastMessage = messages.at(-1);
  const showPendingMessage =
    status === "submitted" && lastMessage?.role === "user";
  const inputOrbState =
    status === "submitted"
      ? "connecting"
      : status === "streaming" && lastMessage?.role === "assistant"
        ? deriveAgentOrbState(lastMessage.parts, true)
        : input.trim()
          ? "listening"
          : "breathing";

  // Last usage reported by the agent (metadata of the final message of a turn).
  const usage = useMemo<UsageState | null>(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      const reported =
        message?.role === "assistant" ? message.metadata?.usage : undefined;

      if (reported) {
        return {
          promptTokens: reported.inputTokens,
          completionTokens: reported.outputTokens,
          contextWindow: getAgentModel(model).contextWindow,
        };
      }
    }

    return null;
  }, [messages, model]);

  const creditRequired =
    error?.message.includes(CREDIT_REQUIRED_CODE) ?? false;
  const turnCost = usage
    ? formatUsdMicros(
        turnCostUsdMicros(model, {
          inputTokens: usage.promptTokens,
          outputTokens: usage.completionTokens,
        }),
        locale,
      )
    : null;

  const submit = (value: string) => {
    const text = value.trim();

    if (!text || isBusy || !available) {
      return;
    }

    const pendingAttachments = attachments;
    setInput("");
    setAttachments([]);
    setAttachmentsOpen(false);

    if (messages.length === 0) {
      onTitleChange?.(truncateConversationTitle(text, newConversationTitle));
    }

    void (async () => {
      const files =
        pendingAttachments.length > 0
          ? await attachmentsToFileParts(pendingAttachments)
          : undefined;

      await sendMessage(
        files && files.length > 0 ? { text, files } : { text },
        { body: { model, locale, conversationId: activeIdRef.current } },
      );
    })();
  };

  const resetConversation = () => {
    setMessages([]);
    setInput("");
    setAttachments([]);
    setAttachmentsOpen(false);
    setActiveId(null);
    activeIdRef.current = null;
    syncThreadParam(null);
    onTitleChange?.(newConversationTitle);
  };

  const selectConversation = (id: string) => {
    if (isBusy || id === activeId) {
      return;
    }

    void threads.load(id).then((loaded) => {
      if (!loaded) {
        return;
      }

      setMessages(loaded);
      setActiveId(id);
      activeIdRef.current = id;
      syncThreadParam(id);
      setInput("");
      setAttachments([]);
      setAttachmentsOpen(false);
      const selected = threads.conversations.find((item) => item.id === id);

      if (selected) {
        onTitleChange?.(selected.title);
      }
    });
  };

  const removeConversation = (id: string) => {
    void threads.remove(id).then((removed) => {
      if (removed && activeIdRef.current === id) {
        resetConversation();
      }
    });
  };

  const suggestions = [
    t(`suggestions.${area}.first`),
    t(`suggestions.${area}.second`),
    t(`suggestions.${area}.third`),
  ];

  return (
    // overflow-visible keeps the model dropdown from being clipped.
    <ChatApp
      className={cn(
        "flex flex-col overflow-visible rounded-none border-0 bg-transparent",
        isDock
          ? "h-full min-h-0"
          : "h-[calc(100dvh-7.5rem)] min-h-[28rem] sm:h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-9.5rem)]",
      )}
    >
      <LayoutGroup>
        <div
          className={cn(
            "relative flex h-full min-h-0 flex-1 flex-col",
            !hasConversation && !isDock && "justify-center pt-16 md:pt-24",
          )}
        >
          <div
            className={cn(
              "z-10 flex items-center gap-2",
              isDock
                ? "border-border h-10 shrink-0 justify-between border-b pr-1.5 pl-3 [&_[data-slot=button]]:size-7"
                : "absolute top-0 right-0",
            )}
          >
            {headerStart}
            <div className="flex shrink-0 items-center gap-0.5">
              <AgentConversationMenu
                conversations={threads.conversations}
                activeId={activeId}
                disabled={isBusy}
                onNewConversation={resetConversation}
                onSelect={selectConversation}
                onDelete={removeConversation}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={newConversationTitle}
                title={newConversationTitle}
                onClick={resetConversation}
                disabled={!hasConversation || isBusy}
              >
                <MessageSquarePlusIcon className="size-4" />
              </Button>
              {usage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("contextUsage")}
                      title={t("contextUsage")}
                    >
                      <UsageRing usage={usage} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72 p-3">
                    <UsageMeter
                      usage={usage}
                      className="max-w-none"
                      labels={{
                        title: t("usage.title"),
                        meter: t("usage.meter"),
                        prompt: t("usage.prompt"),
                        completion: t("usage.completion"),
                      }}
                    />
                    {turnCost ? (
                      <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                        {t("usage.cost", { cost: turnCost })}
                      </p>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {headerEnd}
            </div>
          </div>

          <AnimatePresence initial={false} mode="popLayout">
            {hasConversation ? (
              <motion.div
                key="thread"
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, transform: "translateY(8px)" }
                }
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, transform: "translateY(8px)" }
                }
                transition={reduce ? { duration: 0 } : FADE_TRANSITION}
                className="relative min-h-0 flex-1"
              >
                <div
                  aria-hidden="true"
                  className="from-background pointer-events-none absolute inset-x-0 top-0 z-[1] h-20 bg-gradient-to-b from-25% to-transparent"
                />
                <MessageScroller
                  className={cn(
                    "h-full min-h-0 pb-4",
                    isDock ? "px-3" : "pr-12 sm:pr-16",
                  )}
                  contentClassName={isDock ? "pt-4" : "pt-16"}
                  busy={isBusy}
                  navigation="rail"
                  label={t("threadLabel")}
                  navigationLabel={t("messageNavigation")}
                >
                  <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                    {messages.map((message, index) => (
                      <AgentMessage
                        key={message.id}
                        message={message}
                        isLast={index === messages.length - 1}
                        isStreaming={isBusy}
                      />
                    ))}
                    {showPendingMessage ? <AgentPendingMessage /> : null}
                    {error && creditRequired ? (
                      <p
                        role="alert"
                        className="text-warning-deep flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
                      >
                        <span>{t("wallet.required")}</span>
                        <Link
                          href={agentProfileBillingHref(area)}
                          className="text-link-deep font-medium underline-offset-4 hover:underline"
                        >
                          {t("wallet.buy")}
                        </Link>
                      </p>
                    ) : null}
                    {error && !creditRequired ? (
                      <p role="alert" className="text-error-deep text-xs">
                        {t("error")}
                      </p>
                    ) : null}
                  </div>
                </MessageScroller>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence initial={false} mode="popLayout">
            {!hasConversation ? (
              <motion.div
                key="welcome"
                initial={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, transform: "translateY(8px)" }
                }
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={
                  reduce
                    ? { opacity: 0 }
                    : { opacity: 0, transform: "translateY(-8px)" }
                }
                transition={reduce ? { duration: 0 } : FADE_TRANSITION}
                className={cn(
                  "mx-auto mb-4 flex w-full max-w-3xl flex-col items-center gap-4 px-4 text-center",
                  isDock && "my-auto",
                )}
              >
                <ThinkingOrbGlyph
                  state="breathing"
                  size={isDock ? 32 : 64}
                  speed={0.7}
                  decorative
                  className="opacity-80"
                />
                <div>
                  <p className="text-sm font-medium">
                    {t(`welcome.${area}.title`)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(`welcome.${area}.subtitle`)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => submit(suggestion)}
                      disabled={!available}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <motion.div
            layout={reduce ? false : "position"}
            transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
            className={cn(
              "relative z-20 mx-auto w-full max-w-3xl pt-2",
              isDock && "px-3 pb-3",
            )}
          >
            {readOnly ? (
              <p className="text-muted-foreground mb-2 text-center text-xs">
                {t("readOnlyNotice")}
              </p>
            ) : null}
            {!available ? (
              <p
                role="status"
                className="text-warning-deep mb-2 text-center text-xs"
              >
                {t("unavailable")}
              </p>
            ) : null}
            <PromptInput
              value={input}
              onValueChange={setInput}
              onSubmit={submit}
              loading={isBusy}
              onStop={stop}
              disabled={!available}
              placeholder={t(`placeholder.${area}`)}
              aria-label={t("inputLabel")}
              submitLabel={t("composer.send")}
              stopLabel={t("composer.stop")}
              chooseModelLabel={t("composer.chooseModel")}
              models={modelOptions}
              model={model}
              onModelChange={selectModel}
              leadingAction={
                <AgentAttachments
                  open={attachmentsOpen}
                  onOpenChange={setAttachmentsOpen}
                  items={attachments}
                  onItemsChange={setAttachments}
                  disabled={isBusy || !available}
                />
              }
              submitIndicator={
                <ThinkingOrbGlyph
                  state={inputOrbState}
                  size={20}
                  theme="dark"
                  decorative
                />
              }
            />
          </motion.div>
        </div>
      </LayoutGroup>
    </ChatApp>
  );
}
