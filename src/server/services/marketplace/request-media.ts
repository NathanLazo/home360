import "server-only";

import type { PrismaClient } from "@generated/prisma";
import {
  createDownloadUrl,
  isOwnedMediaPathname,
  type MediaKind,
} from "~/server/services/media/blob";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Media kinds a service request may reference (photos feed the AI). */
export const REQUEST_MEDIA_KINDS: readonly MediaKind[] = [
  "requestPhoto",
  "requestVideo",
];

export type SignedRequestMedia = {
  imageUrls: string[];
  videoUrls: string[];
};

function isPathnameOfKind(pathname: string, kind: MediaKind): boolean {
  return pathname.split("/")[1] === kind;
}

/** Every pathname must live in the caller's own request-media namespace. */
export function ownsRequestMedia(
  userId: string,
  mediaPathnames: string[],
): boolean {
  return mediaPathnames.every((pathname) =>
    isOwnedMediaPathname(pathname, userId, REQUEST_MEDIA_KINDS),
  );
}

/**
 * Exchanges owned pathnames for short-lived signed URLs split by kind. A
 * video alone is enough: the diagnosis only needs at least one media item.
 */
export async function signRequestMedia(
  db: PrismaClient,
  input: { userId: string; mediaPathnames: string[] },
): Promise<
  ServiceResult<SignedRequestMedia, "VALIDATION_ERROR" | "INTERNAL_ERROR">
> {
  if (input.mediaPathnames.length === 0) {
    return svcFail(
      "VALIDATION_ERROR",
      "At least one photo or video is required",
    );
  }

  const imageUrls: string[] = [];
  const videoUrls: string[] = [];

  for (const pathname of input.mediaPathnames) {
    const grant = await createDownloadUrl(db, {
      userId: input.userId,
      pathname,
    });

    if (!grant.ok) {
      return svcFail("INTERNAL_ERROR", "Could not resolve request media");
    }

    if (isPathnameOfKind(pathname, "requestPhoto")) {
      imageUrls.push(grant.data.url);
    } else {
      videoUrls.push(grant.data.url);
    }
  }

  return svcOk({ imageUrls, videoUrls });
}
