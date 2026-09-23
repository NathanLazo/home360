export type EvidenceKind = "image" | "video" | "pdf" | "other";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "heic",
  "heif",
  "bmp",
  "svg",
]);

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "ogv", "3gp"]);

/**
 * Classifies an evidence URL by the extension of its path (query strings and
 * fragments of signed URLs are ignored). Shared by the admin evidence grid and
 * the AI dispute summary so both describe the same file the same way.
 */
export function evidenceKindFromUrl(url: string): EvidenceKind {
  let pathname = url;

  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = url.split(/[?#]/u)[0] ?? url;
  }

  const extension = pathname.split(".").at(-1)?.toLowerCase() ?? "";

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  if (VIDEO_EXTENSIONS.has(extension)) {
    return "video";
  }

  if (extension === "pdf") {
    return "pdf";
  }

  return "other";
}
