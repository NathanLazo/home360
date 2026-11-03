"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

/** Command that registers the HOME360 MCP server in Claude Code. */
export function claudeCodeCommand(endpoint: string, token: string): string {
  return `claude mcp add --transport http --scope user home360 ${endpoint} --header "Authorization: Bearer ${token}"`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * MCP connections of the profile: list, one-click create (the command is
 * copied right away; the token is shown only in this session) and revoke.
 */
export function useMcpConnections() {
  const t = useTranslations("profile.mcp");
  const profile = useTranslations("profile");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const listQuery = api.mcp.listTokens.useQuery();
  const createMutation = api.mcp.createToken.useMutation();
  const revokeMutation = api.mcp.revokeToken.useMutation();
  const [command, setCommand] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const list = unwrapEnvelope(listQuery);

  function reportError(code: string | null) {
    toast.error(
      code === null ? profile("feedback.transportError") : errors(code),
    );
  }

  async function connect(endpoint: string) {
    try {
      const response = await createMutation.mutateAsync({
        name: t("defaultName"),
      });

      if (!response.result) {
        reportError(response.error);
        return;
      }

      const next = claudeCodeCommand(endpoint, response.result.token);
      setCommand(next);
      await utils.mcp.listTokens.invalidate();
      toast.success((await copyText(next)) ? t("copied") : t("created"));
    } catch {
      reportError(null);
    }
  }

  async function revoke(id: string) {
    setRevokingId(id);

    try {
      const response = await revokeMutation.mutateAsync({ id });

      if (!response.result) {
        reportError(response.error);
        return;
      }

      toast.success(t("revoked"));
      await utils.mcp.listTokens.invalidate();
    } catch {
      reportError(null);
    } finally {
      setRevokingId(null);
    }
  }

  return {
    list,
    retry: () => void listQuery.refetch(),
    command,
    connecting: createMutation.isPending,
    revokingId,
    connect,
    revoke,
    copy: copyText,
  };
}
