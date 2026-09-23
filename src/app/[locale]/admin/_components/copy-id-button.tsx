"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ADMIN_COPIED_HOLD_MS, PRESS_CONTROL_CLASS } from "./admin-motion";
import { IconSwap, useTransientFlag } from "~/components/motion";
import { cn } from "~/lib/utils";

/**
 * Copies an internal id for support hand-offs. The copy glyph swaps to a
 * check while the confirmation holds, and a polite live region announces it,
 * so the feedback never depends on motion or colour alone.
 */
export function CopyIdButton({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const t = useTranslations("admin.feedback");
  const [copied, raiseCopied] = useTransientFlag(ADMIN_COPIED_HOLD_MS);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      raiseCopied();
    } catch {
      // Clipboard denied: the id stays visible and selectable.
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t("copyId")}
        title={t("copyId")}
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 font-mono text-xs tabular-nums focus-visible:ring-2 focus-visible:outline-none",
          PRESS_CONTROL_CLASS,
          className,
        )}
      >
        <IconSwap
          swapped={copied}
          from={<CopyIcon className="size-3.5" />}
          to={<CheckIcon className="size-3.5 text-emerald-600" />}
        />
        <span className="max-w-32 truncate">{value}</span>
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </>
  );
}
