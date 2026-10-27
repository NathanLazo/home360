import { tool } from "ai";
import { z } from "zod";

import type { AgentAttachmentStore } from "../agent-attachments";
import { runTool, type AgentToolFailure } from "../tool-runtime";

/** Shared by every catalog that consumes chat attachments (admin, business). */
export function createListChatAttachmentsTool(
  attachments: AgentAttachmentStore,
  description: string,
) {
  return tool({
    description,
    inputSchema: z.object({}),
    execute: () =>
      runTool(() =>
        Promise.resolve({
          result: {
            attachments: [...attachments.values()].map(
              ({ filename, mediaType, sizeBytes }) => ({
                filename,
                mediaType,
                sizeBytes,
              }),
            ),
          },
          error: null,
          status: 200,
          message: "Conversation attachments listed",
        }),
      ),
  });
}

export function attachmentNotFound(
  missing: string[],
  available: string[],
  hint: string,
): AgentToolFailure {
  return {
    result: null,
    error: "ATTACHMENT_NOT_FOUND",
    status: 404,
    message: `No attachment named: ${missing.join(", ")}. Available in this conversation: ${
      available.length > 0 ? available.join(", ") : "none"
    }. ${hint}`,
  };
}
