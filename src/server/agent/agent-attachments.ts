import type { UIMessage } from "ai";

/**
 * One file the user attached in the conversation, decoded from its data URL.
 * The base64 body never reaches the model: tools receive filenames and this
 * store resolves them server-side (F8 receipts flow).
 */
export type AgentAttachment = {
  filename: string;
  mediaType: string;
  sizeBytes: number;
  dataBase64: string;
};

export type AgentAttachmentStore = ReadonlyMap<string, AgentAttachment>;

export const EMPTY_ATTACHMENT_STORE: AgentAttachmentStore = new Map();

const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.+)$/u;

/**
 * Collects the file parts of every user message into a filename-keyed store.
 * The chat sends attachments as base64 data URLs (`agent-chat.files.ts`);
 * remote URLs are ignored. On duplicate names the newest attachment wins,
 * matching what the user sees in the thread.
 */
export function collectAgentAttachments(
  messages: readonly UIMessage[],
): AgentAttachmentStore {
  const store = new Map<string, AgentAttachment>();
  let unnamedCount = 0;

  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }

    for (const part of message.parts) {
      if (part.type !== "file") {
        continue;
      }

      const match = DATA_URL_PATTERN.exec(part.url);

      if (!match) {
        continue;
      }

      const [, mediaType = "application/octet-stream", dataBase64 = ""] = match;

      if (dataBase64.length === 0) {
        continue;
      }

      unnamedCount += 1;
      const filename = part.filename?.trim().length
        ? part.filename.trim()
        : `attachment-${unnamedCount}`;

      store.set(filename, {
        filename,
        mediaType,
        // Base64 shrinks ~3/4 when decoded; padding makes this approximate.
        sizeBytes: Math.floor((dataBase64.length * 3) / 4),
        dataBase64,
      });
    }
  }

  return store;
}
