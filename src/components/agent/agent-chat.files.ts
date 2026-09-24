import type { FileUIPart } from "ai";

import type { AttachmentUploadItem } from "~/components/motion/attachment-upload";

/** Types the model reads natively through the AI Gateway. */
export const AGENT_ATTACHMENT_ACCEPT =
  "image/*,application/pdf,text/plain,text/csv,text/markdown";
export const AGENT_ATTACHMENT_MAX_FILES = 5;
export const AGENT_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      reject(reader.error ?? new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

export async function attachmentsToFileParts(
  items: AttachmentUploadItem[],
): Promise<FileUIPart[]> {
  const parts: FileUIPart[] = [];

  for (const item of items) {
    if (!item.file) {
      continue;
    }

    parts.push({
      type: "file",
      mediaType: item.file.type || "application/octet-stream",
      filename: item.name,
      url: await readFileAsDataUrl(item.file),
    });
  }

  return parts;
}
