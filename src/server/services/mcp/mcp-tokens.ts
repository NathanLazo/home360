import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient, UserRole } from "@generated/prisma";
import { panelAreaForRole, type PanelAgentArea } from "~/lib/agent/agent-area";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Active tokens per user: enough for a laptop, a desktop and a CI box. */
export const MCP_TOKENS_PER_USER = 10;

const TOKEN_PREFIX = "h360_";
const VISIBLE_PREFIX_LENGTH = TOKEN_PREFIX.length + 6;
/** `lastUsedAt` is written at most once per window to keep calls read-only. */
const LAST_USED_WRITE_WINDOW_MS = 5 * 60 * 1000;

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type McpTokenItem = {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  createdAt: Date;
};

export async function listMcpTokens(
  db: PrismaClient,
  userId: string,
): Promise<McpTokenItem[]> {
  return db.mcpToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
}

export type CreatedMcpToken = McpTokenItem & {
  /** Plain token: returned once, never stored. */
  token: string;
};

export async function createMcpToken(
  db: PrismaClient,
  input: { userId: string; name: string },
): Promise<ServiceResult<CreatedMcpToken, "MCP_TOKEN_LIMIT_REACHED">> {
  const active = await db.mcpToken.count({
    where: { userId: input.userId, revokedAt: null },
  });

  if (active >= MCP_TOKENS_PER_USER) {
    return svcFail("MCP_TOKEN_LIMIT_REACHED");
  }

  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const row = await db.mcpToken.create({
    data: {
      userId: input.userId,
      name: input.name,
      tokenHash: hashMcpToken(token),
      prefix: token.slice(0, VISIBLE_PREFIX_LENGTH),
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });

  return svcOk({ ...row, token });
}

/** Revocation keeps the row (audit); a revoked token never authenticates. */
export async function revokeMcpToken(
  db: PrismaClient,
  input: { userId: string; id: string },
): Promise<ServiceResult<{ id: string }>> {
  const revoked = await db.mcpToken.updateMany({
    where: { id: input.id, userId: input.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return revoked.count === 0 ? svcFail("NOT_FOUND") : svcOk({ id: input.id });
}

export type McpPrincipal = {
  userId: string;
  role: UserRole;
  name: string | null;
  area: PanelAgentArea;
};

/**
 * Resolves the user behind a bearer token: active token, not suspended and
 * with a panel role. Any failure is `null` so the endpoint answers a generic
 * 401 without revealing which check failed.
 */
export async function resolveMcpToken(
  db: PrismaClient,
  token: string,
): Promise<McpPrincipal | null> {
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 100) {
    return null;
  }

  const row = await db.mcpToken.findUnique({
    where: { tokenHash: hashMcpToken(token) },
    select: {
      id: true,
      revokedAt: true,
      lastUsedAt: true,
      user: {
        select: { id: true, role: true, name: true, suspendedAt: true },
      },
    },
  });

  if (row?.revokedAt !== null || row.user.suspendedAt !== null) {
    return null;
  }

  const area = panelAreaForRole(row.user.role);

  if (!area) {
    return null;
  }

  const now = Date.now();

  if (
    !row.lastUsedAt ||
    now - row.lastUsedAt.getTime() > LAST_USED_WRITE_WINDOW_MS
  ) {
    await db.mcpToken.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date(now) },
      select: { id: true },
    });
  }

  return {
    userId: row.user.id,
    role: row.user.role,
    name: row.user.name,
    area,
  };
}
