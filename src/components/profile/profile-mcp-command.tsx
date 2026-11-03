"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { IconSwap, useTransientFlag } from "~/components/motion";
import { Button } from "~/components/ui/button";

const COPIED_FEEDBACK_MS = 1_600;

/**
 * The one-time command with its copy control. The token lives only in this
 * render: leaving the page drops it, and the server keeps just its hash.
 */
export function ProfileMcpCommand({
  command,
  onCopy,
}: {
  command: string;
  onCopy: (value: string) => Promise<boolean>;
}) {
  const t = useTranslations("profile.mcp");
  const [copied, flashCopied] = useTransientFlag(COPIED_FEEDBACK_MS);

  async function handleCopy() {
    if (await onCopy(command)) flashCopied();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-canvas-soft shadow-hairline flex items-start gap-2 rounded-xl p-3">
        <code className="text-label min-w-0 flex-1 font-mono break-all select-all">
          {command}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={copied ? t("copiedLabel") : t("copyLabel")}
          onClick={() => void handleCopy()}
        >
          <IconSwap
            swapped={copied}
            from={<CopyIcon className="size-4" />}
            to={<CheckIcon className="size-4" />}
          />
        </Button>
      </div>
      <p className="text-muted-foreground text-label" role="status">
        {t("oneTime")}
      </p>
    </div>
  );
}
