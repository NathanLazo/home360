"use client";

import { LoaderCircleIcon, PlugZapIcon, TerminalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ProfileMcpCommand } from "./profile-mcp-command";
import { ProfileMcpTokenRow } from "./profile-mcp-token-row";
import { ProfileSectionCard } from "./profile-section-card";
import { useMcpConnections } from "./use-mcp-connections";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

/**
 * "Connect to Claude Code": one click mints a personal token, copies the
 * `claude mcp add` command and lists active connections. The MCP server
 * exposes exactly the assistant tools of the user's role.
 */
export function ProfileMcpCard({ disabled }: { disabled: boolean }) {
  const t = useTranslations("profile.mcp");
  const mcp = useMcpConnections();

  return (
    <ProfileSectionCard
      id="mcp"
      title={t("title")}
      description={t("description")}
      icon={TerminalIcon}
    >
      {mcp.list.status === "pending" ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : mcp.list.status === "error" ? (
        <SectionError
          title={t("loadError")}
          code={mcp.list.code}
          onRetry={mcp.retry}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className="self-start"
              disabled={disabled || mcp.connecting}
              aria-busy={mcp.connecting || undefined}
              onClick={() => {
                if (mcp.list.status === "success") {
                  void mcp.connect(mcp.list.data.endpoint);
                }
              }}
            >
              {mcp.connecting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <PlugZapIcon aria-hidden="true" />
              )}
              {t("connect")}
            </Button>
            {mcp.command ? (
              <ProfileMcpCommand command={mcp.command} onCopy={mcp.copy} />
            ) : (
              <p className="text-muted-foreground text-copy-sm">{t("howTo")}</p>
            )}
            <p className="text-muted-foreground text-label">
              {t("endpoint")}{" "}
              <code className="font-mono">{mcp.list.data.endpoint}</code>
            </p>
          </div>

          {mcp.list.data.tokens.length === 0 ? (
            <p className="text-muted-foreground text-copy-sm bg-canvas-soft rounded-xl px-4 py-3">
              {t("empty")}
            </p>
          ) : (
            <ul
              aria-label={t("listLabel")}
              className="divide-hairline -my-3 divide-y"
            >
              {mcp.list.data.tokens.map((token) => (
                <ProfileMcpTokenRow
                  key={token.id}
                  token={token}
                  disabled={disabled}
                  revoking={mcp.revokingId === token.id}
                  onRevoke={(id) => void mcp.revoke(id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </ProfileSectionCard>
  );
}
