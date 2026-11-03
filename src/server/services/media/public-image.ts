import "server-only";

import { createId } from "@paralleldrive/cuid2";
import { put } from "@vercel/blob";

import { env } from "~/env";
import { svcFail, svcOk, type ServiceResult } from "../service-result";
import { readMediaBytes, type MediaBytes } from "./blob";

/**
 * Public images of the panel (owner avatar, business logo, product and service
 * photos). The Blob store is private, so they are stored under
 * `public/{scope}/{userId}/…` and served by `/api/public-media/[...path]`,
 * which only ever streams this namespace.
 */
export const PUBLIC_IMAGE_SCOPES = ["avatar", "logo", "catalog"] as const;
export type PublicImageScope = (typeof PUBLIC_IMAGE_SCOPES)[number];

export const PUBLIC_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const PUBLIC_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;

const EXTENSIONS: Record<(typeof PUBLIC_IMAGE_CONTENT_TYPES)[number], string> =
  {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

const PUBLIC_ROUTE = "/api/public-media/";
const PATHNAME_PATTERN =
  /^public\/(avatar|logo|catalog)\/[a-z0-9]{20,32}\/[a-z0-9]{20,32}\.(jpg|png|webp)$/u;

function isPublicImageContentType(
  value: string,
): value is (typeof PUBLIC_IMAGE_CONTENT_TYPES)[number] {
  return (PUBLIC_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

export function publicImageUrl(pathname: string): string {
  return new URL(`${PUBLIC_ROUTE}${pathname}`, env.APP_URL).toString();
}

/** Whether `pathname` is a well-formed image `userId` uploaded in `scope`. */
export function isOwnPublicImage(
  scope: PublicImageScope,
  userId: string,
  pathname: string,
): boolean {
  return (
    PATHNAME_PATTERN.test(pathname) &&
    pathname.startsWith(`public/${scope}/${userId}/`)
  );
}

/** Avatar shown in the panel: the uploaded one wins over the OAuth picture. */
export function resolveAvatarUrl(user: {
  avatarPathname: string | null;
  image: string | null;
}): string | null {
  return user.avatarPathname ? publicImageUrl(user.avatarPathname) : user.image;
}

export function nullablePublicImageUrl(pathname: string | null): string | null {
  return pathname ? publicImageUrl(pathname) : null;
}

export type PublicImageUpload = { pathname: string; url: string };

export async function uploadPublicImage(input: {
  userId: string;
  scope: PublicImageScope;
  contentType: string;
  dataBase64: string;
}): Promise<
  ServiceResult<PublicImageUpload, "VALIDATION_ERROR" | "INTERNAL_ERROR">
> {
  if (!isPublicImageContentType(input.contentType)) {
    return svcFail("VALIDATION_ERROR", "Only JPEG, PNG or WebP images");
  }

  const body = Buffer.from(input.dataBase64, "base64");

  if (body.length === 0 || body.length > PUBLIC_IMAGE_MAX_SIZE_BYTES) {
    return svcFail("VALIDATION_ERROR", "Image must be between 1 B and 5 MB");
  }

  const token = env.BLOB_READ_WRITE_TOKEN;

  if (!token) {
    return svcFail("INTERNAL_ERROR", "Blob storage is not configured");
  }

  const pathname = `public/${input.scope}/${input.userId}/${createId()}.${EXTENSIONS[input.contentType]}`;

  await put(pathname, body, {
    access: "private",
    contentType: input.contentType,
    token,
    addRandomSuffix: false,
  });

  return svcOk({ pathname, url: publicImageUrl(pathname) });
}

/** Bytes of a public image; `null` for anything outside the public namespace. */
export async function readPublicImage(
  pathname: string,
): Promise<MediaBytes | null> {
  if (!PATHNAME_PATTERN.test(pathname)) {
    return null;
  }

  return readMediaBytes(pathname);
}
