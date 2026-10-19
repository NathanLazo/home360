"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { LoaderCircleIcon, SendHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { TranslatableErrorCode } from "~/server/api/contract";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

const MAX_BODY_LENGTH = 2_000;

export function OrderMessageComposer({
  sending,
  disabled,
  onSend,
}: {
  sending: boolean;
  disabled: boolean;
  onSend: (body: string) => Promise<TranslatableErrorCode | null>;
}) {
  const t = useTranslations("dashboard.orders.conversation");
  const errorsT = useTranslations("errors");
  const [body, setBody] = useState("");
  const [error, setError] = useState<TranslatableErrorCode | null>(null);
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const trimmed = body.trim();

  async function submit() {
    if (trimmed.length === 0 || sending) return;
    const failure = await onSend(trimmed);
    setError(failure);
    if (failure === null) setBody("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter keeps the newline.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Label htmlFor={fieldId} className="sr-only">
        {t("composerLabel")}
      </Label>
      <div className="flex items-end gap-2">
        <Textarea
          id={fieldId}
          value={body}
          rows={2}
          maxLength={MAX_BODY_LENGTH}
          placeholder={t("composerPlaceholder")}
          disabled={disabled || sending}
          aria-invalid={error !== null || undefined}
          aria-describedby={error !== null ? errorId : undefined}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-11 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || sending || trimmed.length === 0}
          aria-label={t("send")}
        >
          {sending ? (
            <LoaderCircleIcon
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : (
            <SendHorizontalIcon aria-hidden="true" />
          )}
        </Button>
      </div>
      {error !== null ? (
        <p id={errorId} role="alert" className="text-destructive text-copy-sm">
          {errorsT(error)}
        </p>
      ) : null}
    </form>
  );
}
