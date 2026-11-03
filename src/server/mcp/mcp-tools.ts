import "server-only";

import { asSchema, tool, type JSONSchema7, type Tool, type ToolSet } from "ai";
import { z } from "zod";

import type { AgentAttachment } from "~/server/agent/agent-attachments";
import { createAgentTools } from "~/server/agent/tool-catalog";
import { runTool, type AgentCaller } from "~/server/agent/tool-runtime";
import {
  isOwnedMediaPathname,
  readMediaBytes,
} from "~/server/services/media/blob";
import type { McpPrincipal } from "~/server/services/mcp/mcp-tokens";
import type { McpToolCallResult, McpToolDescriptor } from "./mcp-protocol";

/** Chat-only tools: MCP clients upload files with `createFileUpload`. */
const CHAT_ONLY_TOOLS = new Set(["listChatAttachments"]);

const READ_ONLY_PREFIXES = ["get", "list", "preview", "search", "count"];
const DESTRUCTIVE_MARKERS = ["IRREVERSIBLE", "MONEY MOVEMENT"];

const UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/**
 * Presigned upload for files the MCP client holds locally (spreadsheets,
 * photos). The returned `pathname` is passed as `filename` to the import and
 * image tools; the server reads it back from private storage.
 */
function createFileUploadTool(caller: AgentCaller) {
  return tool({
    description:
      "Upload a local file (Excel .xlsx, CSV, JPEG/PNG/WebP image or PDF, max 10 MB) for the import and image tools. Returns an uploadUrl and a ready-to-run curl command: run it, then pass the returned `pathname` as the `filename` (or an item of `filenames`) argument of the import, image or receipt tools.",
    inputSchema: z.object({
      contentType: z.enum(UPLOAD_CONTENT_TYPES),
      sizeBytes: z
        .number()
        .int()
        .positive()
        .describe("Exact file size in bytes (e.g. from `wc -c`)."),
      localPath: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .optional()
        .describe(
          "Local path of the file, only used to prefill the curl command.",
        ),
    }),
    execute: ({ contentType, sizeBytes, localPath }) =>
      runTool(async () => {
        const grant = await caller.media.createUploadUrl({
          kind: "agentFile",
          contentType,
          sizeBytes,
        });

        if (!grant.result) {
          return grant;
        }

        const file = localPath ?? "<local-file>";

        return {
          ...grant,
          result: {
            pathname: grant.result.pathname,
            expiresAt: grant.result.expiresAt,
            uploadUrl: grant.result.uploadUrl,
            curl: `curl -fsS -X PUT -H "Content-Type: ${contentType}" --data-binary @"${file}" "${grant.result.uploadUrl}"`,
          },
        };
      }),
  });
}

/** The role-scoped catalog an MCP principal sees (no chat-only tools). */
export function buildMcpToolSet(
  principal: McpPrincipal,
  caller: AgentCaller,
  attachments: ReadonlyMap<string, AgentAttachment> = new Map(),
): ToolSet {
  const tools: ToolSet = {
    ...createAgentTools(principal.area, caller, attachments),
    createFileUpload: createFileUploadTool(caller),
  };

  for (const name of CHAT_ONLY_TOOLS) {
    delete tools[name];
  }

  return tools;
}

function annotate(name: string, description: string) {
  const destructive = DESTRUCTIVE_MARKERS.some((marker) =>
    description.includes(marker),
  );

  return {
    readOnlyHint: READ_ONLY_PREFIXES.some((prefix) => name.startsWith(prefix)),
    destructiveHint: destructive,
    openWorldHint: false,
  };
}

/** MCP wants a plain object schema; the draft marker is dropped. */
async function toInputSchema(definition: Tool): Promise<JSONSchema7> {
  const { $schema: _draft, ...schema } = await asSchema(definition.inputSchema)
    .jsonSchema;
  void _draft;

  return schema.type === "object" ? schema : { type: "object", properties: {} };
}

export async function describeMcpTools(
  tools: ToolSet,
): Promise<McpToolDescriptor[]> {
  return Promise.all(
    Object.entries(tools).map(async ([name, definition]) => {
      const description =
        typeof definition.description === "string"
          ? definition.description
          : name;

      return {
        name,
        description,
        inputSchema: await toInputSchema(definition),
        annotations: annotate(name, description),
      };
    }),
  );
}

/** Max files resolved per call (receipts take a handful, imports one). */
const MAX_RESOLVED_FILES = 10;

function fileArguments(args: Record<string, unknown>): string[] {
  const list: unknown = args.filenames;
  const names: unknown[] = [args.filename];

  if (Array.isArray(list)) {
    for (const name of list as unknown[]) {
      names.push(name);
    }
  }

  return names
    .filter((name): name is string => typeof name === "string")
    .slice(0, MAX_RESOLVED_FILES);
}

/**
 * Turns `filename` / `filenames` arguments that are `agentFile` uploads of
 * this user into attachments, so the shared tools resolve them like chat
 * files. Foreign or unknown pathnames are ignored (the tool then reports
 * ATTACHMENT_NOT_FOUND).
 */
export async function resolveMcpAttachments(
  principal: McpPrincipal,
  args: Record<string, unknown>,
): Promise<Map<string, AgentAttachment>> {
  const store = new Map<string, AgentAttachment>();

  for (const pathname of fileArguments(args)) {
    if (!isOwnedMediaPathname(pathname, principal.userId, ["agentFile"])) {
      continue;
    }

    const bytes = await readMediaBytes(pathname);

    if (bytes) {
      store.set(pathname, {
        filename: pathname,
        mediaType: bytes.contentType,
        sizeBytes: bytes.data.byteLength,
        dataBase64: Buffer.from(bytes.data).toString("base64"),
      });
    }
  }

  return store;
}

function textResult(payload: unknown, isError: boolean): McpToolCallResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError,
  };
}

/** Validates the arguments with the tool schema and runs it. Never throws. */
export async function callMcpTool(
  tools: ToolSet,
  name: string,
  args: Record<string, unknown>,
): Promise<McpToolCallResult | null> {
  const definition = tools[name];

  if (!definition?.execute) {
    return null;
  }

  const schema = asSchema(definition.inputSchema);
  const validation = schema.validate
    ? await schema.validate(args)
    : { success: true as const, value: args };

  if (!validation.success) {
    return textResult(
      {
        result: null,
        error: "VALIDATION_ERROR",
        status: 422,
        message: validation.error.message.slice(0, 1_000),
      },
      true,
    );
  }

  const output: unknown = await definition.execute(validation.value, {
    toolCallId: `mcp-${crypto.randomUUID()}`,
    messages: [],
    context: undefined,
  });
  const isError =
    typeof output === "object" &&
    output !== null &&
    "error" in output &&
    output.error !== null &&
    output.error !== undefined;

  return textResult(output, isError);
}
