import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";

import type { PrismaClient } from "../../../../generated/prisma";
import { env } from "~/env";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { authorizeMediaRead } from "./authorize-read";

/**
 * Media namespaces uploaded by the mobile app (M0-W3). Each kind carries its
 * own content-type and size policy; the pathname always embeds the kind so
 * later tickets can authorize reads per resource.
 */
export const MEDIA_KINDS = [
  "requestPhoto",
  "requestVideo",
  "evidence",
  "recording",
  "chatAttachment",
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

const MB = 1024 * 1024;
const GB = 1024 * MB;

const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime"] as const;

/**
 * Upload policy per kind. Sizes/types come from the M0-W3 spec: photos and
 * chat attachments are images up to 10 MB, request videos up to 60 MB and
 * job recordings (T2) up to 2 GB.
 */
const MEDIA_POLICIES: Record<
  MediaKind,
  { allowedContentTypes: readonly string[]; maxSizeBytes: number }
> = {
  requestPhoto: { allowedContentTypes: IMAGE_CONTENT_TYPES, maxSizeBytes: 10 * MB },
  requestVideo: { allowedContentTypes: VIDEO_CONTENT_TYPES, maxSizeBytes: 60 * MB },
  evidence: { allowedContentTypes: IMAGE_CONTENT_TYPES, maxSizeBytes: 10 * MB },
  recording: { allowedContentTypes: VIDEO_CONTENT_TYPES, maxSizeBytes: 2 * GB },
  chatAttachment: { allowedContentTypes: IMAGE_CONTENT_TYPES, maxSizeBytes: 10 * MB },
};

/** File extension per allowed content type; keeps pathnames self-descriptive. */
const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

/** Upload client tokens stay valid long enough for a 2 GB recording upload. */
const UPLOAD_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Signed read URLs are short-lived: the app requests a fresh one per view. */
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

const PATHNAME_PREFIX = "mobile";

export interface UploadTokenGrant {
  token: string;
  pathname: string;
  expiresAt: Date;
}

export interface DownloadUrlGrant {
  url: string;
  pathname: string;
  expiresAt: Date;
}

type MediaServiceError = "VALIDATION_ERROR" | "INTERNAL_ERROR";

function getReadWriteToken(): string | null {
  return env.BLOB_READ_WRITE_TOKEN ?? null;
}

/**
 * Issues a client upload token scoped to a single freshly generated pathname
 * `mobile/{kind}/{userId}/{cuid}.{ext}`. The owner segment always comes from
 * the session user, never from input, so a caller can only ever write inside
 * its own namespace. The blob must be uploaded with `access: "private"`.
 */
export async function createUploadToken(input: {
  userId: string;
  kind: MediaKind;
  contentType: string;
  sizeBytes: number;
}): Promise<ServiceResult<UploadTokenGrant, MediaServiceError>> {
  const policy = MEDIA_POLICIES[input.kind];

  if (!policy.allowedContentTypes.includes(input.contentType)) {
    return svcFail("VALIDATION_ERROR", "Content type not allowed for kind");
  }

  if (input.sizeBytes <= 0 || input.sizeBytes > policy.maxSizeBytes) {
    return svcFail("VALIDATION_ERROR", "File size exceeds the kind limit");
  }

  const readWriteToken = getReadWriteToken();

  if (!readWriteToken) {
    return svcFail("INTERNAL_ERROR", "Blob storage is not configured");
  }

  const extension = CONTENT_TYPE_EXTENSIONS[input.contentType];

  if (!extension) {
    return svcFail("VALIDATION_ERROR", "Content type not allowed");
  }

  const pathname = `${PATHNAME_PREFIX}/${input.kind}/${input.userId}/${createId()}.${extension}`;
  const expiresAt = new Date(Date.now() + UPLOAD_TOKEN_TTL_MS);

  const token = await generateClientTokenFromReadWriteToken({
    token: readWriteToken,
    pathname,
    allowedContentTypes: [input.contentType],
    maximumSizeInBytes: policy.maxSizeBytes,
    validUntil: expiresAt.getTime(),
  });

  return svcOk({ token, pathname, expiresAt });
}

/**
 * Returns a short-lived signed read URL for a private blob the caller may
 * read: either it owns the pathname by prefix (`mobile/{kind}/{userId}/…`,
 * M0-W3) or a persisted reference authorizes it (`authorizeMediaRead`,
 * MA-02 — e.g. the receiver of a chat attachment). Anything else answers a
 * generic NOT_FOUND so the response never reveals whether the blob exists.
 */
export async function createDownloadUrl(
  db: PrismaClient,
  input: {
    userId: string;
    pathname: string;
  },
): Promise<ServiceResult<DownloadUrlGrant, MediaServiceError>> {
  if (
    !isOwnedMediaPathname(input.pathname, input.userId) &&
    !(await authorizeMediaRead(db, input.userId, input.pathname))
  ) {
    return svcFail("NOT_FOUND", "Blob not found");
  }

  const readWriteToken = getReadWriteToken();

  if (!readWriteToken) {
    return svcFail("INTERNAL_ERROR", "Blob storage is not configured");
  }

  const expiresAt = new Date(Date.now() + DOWNLOAD_URL_TTL_MS);

  const signedToken = await issueSignedToken({
    token: readWriteToken,
    pathname: input.pathname,
    operations: ["get"],
    validUntil: expiresAt.getTime(),
  });

  const { presignedUrl } = await presignUrl(signedToken, {
    operation: "get",
    pathname: input.pathname,
    access: "private",
    validUntil: expiresAt.getTime(),
  });

  return svcOk({ url: presignedUrl, pathname: input.pathname, expiresAt });
}

/**
 * True when the pathname is exactly `mobile/{kind}/{userId}/{file}` for one of
 * the accepted kinds and the session user. The single trailing segment rules
 * out traversal tricks (`..`, nested slashes, empty segments). Exported so
 * other services (e.g. request creation, M2-W2) can authorize media
 * references with the exact same rule.
 */
export function isOwnedMediaPathname(
  pathname: string,
  userId: string,
  kinds: readonly MediaKind[] = MEDIA_KINDS,
): boolean {
  const segments = pathname.split("/");

  if (segments.length !== 4) {
    return false;
  }

  const [prefix, kind, owner, file] = segments;

  return (
    prefix === PATHNAME_PREFIX &&
    (kinds as readonly string[]).includes(kind ?? "") &&
    owner === userId &&
    file !== undefined &&
    file.length > 0 &&
    file !== "." &&
    file !== ".."
  );
}
