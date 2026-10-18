import "server-only";

import type { PrismaClient } from "@generated/prisma";
import {
  canReadMedia,
  isOwnedMediaPathname,
  type MediaKind,
} from "~/server/services/media/blob";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/** Media kinds a service request may reference (photos feed the AI). */
export const REQUEST_MEDIA_KINDS: readonly MediaKind[] = [
  "requestPhoto",
  "requestVideo",
];

export type ResolvedRequestMedia = {
  /** Photo pathnames; the diagnosis reads their bytes server-side. */
  imagePathnames: string[];
  /** Videos are not sent to the model, only counted as context. */
  videoCount: number;
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
 * Authorizes the request media and splits it by kind. A video alone is
 * enough: the diagnosis only needs at least one media item.
 */
export async function resolveRequestMedia(
  db: PrismaClient,
  input: { userId: string; mediaPathnames: string[] },
): Promise<
  ServiceResult<ResolvedRequestMedia, "VALIDATION_ERROR" | "INTERNAL_ERROR">
> {
  if (input.mediaPathnames.length === 0) {
    return svcFail(
      "VALIDATION_ERROR",
      "At least one photo or video is required",
    );
  }

  const imagePathnames: string[] = [];
  let videoCount = 0;

  for (const pathname of input.mediaPathnames) {
    if (!(await canReadMedia(db, input.userId, pathname))) {
      return svcFail("INTERNAL_ERROR", "Could not resolve request media");
    }

    if (isPathnameOfKind(pathname, "requestPhoto")) {
      imagePathnames.push(pathname);
    } else {
      videoCount += 1;
    }
  }

  return svcOk({ imagePathnames, videoCount });
}
