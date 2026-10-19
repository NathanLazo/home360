import "server-only";

import type { PrismaClient } from "@generated/prisma";
import { createDownloadUrl } from "~/server/services/media/blob";

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Turns a persisted evidence reference into a readable URL for the viewer.
 * Mobile uploads persist Blob pathnames (M6-W1) that must be signed per read
 * through the MA-02 authorization; legacy/seed rows may already hold an
 * absolute URL. Anything that cannot be signed resolves to `null`.
 */
export async function resolveOrderMediaUrl(
  db: PrismaClient,
  input: { userId: string; reference: string | null },
): Promise<string | null> {
  if (input.reference === null || input.reference.length === 0) {
    return null;
  }

  if (isAbsoluteUrl(input.reference)) {
    return input.reference;
  }

  const grant = await createDownloadUrl(db, {
    userId: input.userId,
    pathname: input.reference,
  });

  return grant.ok ? grant.data.url : null;
}

export async function resolveOrderMediaUrls(
  db: PrismaClient,
  input: { userId: string; references: string[] },
): Promise<string[]> {
  const urls = await Promise.all(
    input.references.map((reference) =>
      resolveOrderMediaUrl(db, { userId: input.userId, reference }),
    ),
  );

  return urls.filter((url): url is string => url !== null);
}

export type SignedMedia = { pathname: string; url: string };

/**
 * Signs private Blob pathnames for the viewer through the MA-02 read rule,
 * keeping the pathname next to its short-lived URL (the app re-signs per
 * view). Pathnames the viewer may not read are dropped.
 */
export async function signMediaPathnames(
  db: PrismaClient,
  input: { userId: string; pathnames: string[] },
): Promise<SignedMedia[]> {
  const signed = await Promise.all(
    input.pathnames.map(async (pathname) => {
      const url = await resolveOrderMediaUrl(db, {
        userId: input.userId,
        reference: pathname,
      });

      return url === null ? null : { pathname, url };
    }),
  );

  return signed.filter((item): item is SignedMedia => item !== null);
}
