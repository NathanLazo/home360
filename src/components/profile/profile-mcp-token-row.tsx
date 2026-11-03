"use client";

import { KeyRoundIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { useAppFormatter } from "~/i18n/use-app-formatter";

export type McpTokenRowData = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export function ProfileMcpTokenRow({
  token,
  disabled,
  revoking,
  onRevoke,
}: {
  token: McpTokenRowData;
  disabled: boolean;
  revoking: boolean;
  onRevoke: (id: string) => void;
}) {
  const t = useTranslations("profile.mcp");
  const format = useAppFormatter();
  const when = (date: Date) =>
    format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden="true"
        className="bg-canvas-soft text-muted-foreground shadow-hairline flex size-9 shrink-0 items-center justify-center rounded-full"
      >
        <KeyRoundIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-copy-sm truncate font-medium">
          {token.name}
          <span className="text-muted-foreground font-mono font-normal">
            {" "}
            · {token.prefix}…
          </span>
        </p>
        <p className="text-muted-foreground text-label font-mono">
          {token.lastUsedAt
            ? t("lastUsed", { date: when(token.lastUsedAt) })
            : t("neverUsed", { date: when(token.createdAt) })}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t("revokeLabel", { name: token.name })}
        aria-busy={revoking || undefined}
        disabled={disabled || revoking}
        onClick={() => onRevoke(token.id)}
      >
        {revoking ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <XIcon aria-hidden="true" />
        )}
        {t("revoke")}
      </Button>
    </li>
  );
}
