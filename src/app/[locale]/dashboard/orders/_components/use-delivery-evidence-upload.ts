"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { TranslatableErrorCode } from "~/server/api/contract";
import { toErrorCode } from "~/lib/trpc-errors";
import { api } from "~/trpc/react";

/** Same policy as the `evidence` media kind (the server re-validates). */
export const EVIDENCE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const EVIDENCE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/** `order.markDelivered` accepts 1–10 evidence pathnames (D10-2). */
export const EVIDENCE_PHOTO_MAX_COUNT = 10;

export type EvidencePhotoFailure =
  | { kind: "type" }
  | { kind: "size" }
  | { kind: "upload" }
  | { kind: "code"; code: TranslatableErrorCode };

export type EvidencePhoto = {
  id: string;
  name: string;
  /** Local object URL for the thumbnail; revoked when the photo leaves. */
  previewUrl: string;
  status: "uploading" | "uploaded" | "error";
  /** 0–100 while uploading. */
  progress: number;
  pathname: string | null;
  failure: EvidencePhotoFailure | null;
};

/** PUT with progress events: `fetch` exposes no upload progress. */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () =>
      resolve(request.status >= 200 && request.status < 300);
    request.onerror = () => resolve(false);
    request.onabort = () => resolve(false);
    request.send(file);
  });
}

function localFailure(file: File): EvidencePhotoFailure | null {
  if (!EVIDENCE_PHOTO_TYPES.includes(file.type)) return { kind: "type" };
  if (file.size > EVIDENCE_PHOTO_MAX_BYTES) return { kind: "size" };
  return null;
}

/**
 * Delivery evidence photos (D10-2) go straight to private Blob storage
 * through a scoped presigned PUT (`media.createUploadUrl`, kind `evidence`,
 * M0-W3): the bytes never transit the app server and only the pathnames are
 * sent to `order.markDelivered`. Each photo uploads on its own, so one
 * failure never blocks the rest and can be retried in place.
 */
export function useDeliveryEvidenceUpload() {
  const { mutateAsync: createUploadUrl } =
    api.media.createUploadUrl.useMutation();
  const [photos, setPhotos] = useState<EvidencePhoto[]>([]);
  const files = useRef(new Map<string, File>());
  const previews = useRef(new Set<string>());

  const patch = useCallback(
    (id: string, update: Partial<EvidencePhoto>) =>
      setPhotos((current) =>
        current.map((photo) =>
          photo.id === id ? { ...photo, ...update } : photo,
        ),
      ),
    [],
  );

  const uploadOne = useCallback(
    async (id: string, file: File) => {
      patch(id, { status: "uploading", progress: 0, failure: null });

      try {
        const grant = await createUploadUrl({
          kind: "evidence",
          contentType: file.type,
          sizeBytes: file.size,
        });

        if (grant.error !== null || !grant.result) {
          patch(id, {
            status: "error",
            failure: grant.error
              ? { kind: "code", code: grant.error }
              : { kind: "upload" },
          });
          return;
        }

        const { uploadUrl, pathname } = grant.result;
        const stored = await putWithProgress(uploadUrl, file, (progress) =>
          patch(id, { progress }),
        );

        patch(
          id,
          stored
            ? { status: "uploaded", progress: 100, pathname }
            : { status: "error", failure: { kind: "upload" } },
        );
      } catch (error: unknown) {
        patch(id, {
          status: "error",
          failure: { kind: "code", code: toErrorCode(error) },
        });
      }
    },
    [createUploadUrl, patch],
  );

  /** Adds files up to the 10-photo cap; returns how many were left out. */
  function add(selected: File[]): number {
    const room = Math.max(0, EVIDENCE_PHOTO_MAX_COUNT - photos.length);
    const accepted = selected.slice(0, room);
    const queued: Array<{ photo: EvidencePhoto; file: File }> = accepted.map(
      (file) => {
        const previewUrl = URL.createObjectURL(file);
        previews.current.add(previewUrl);
        const failure = localFailure(file);
        return {
          file,
          photo: {
            id: crypto.randomUUID(),
            name: file.name,
            previewUrl,
            status: failure ? "error" : "uploading",
            progress: 0,
            pathname: null,
            failure,
          },
        };
      },
    );

    setPhotos((current) => [...current, ...queued.map(({ photo }) => photo)]);

    for (const { photo, file } of queued) {
      files.current.set(photo.id, file);
      if (!photo.failure) void uploadOne(photo.id, file);
    }

    return selected.length - accepted.length;
  }

  function retry(id: string) {
    const file = files.current.get(id);
    if (file && !localFailure(file)) void uploadOne(id, file);
  }

  function remove(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
        previews.current.delete(photo.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
    files.current.delete(id);
  }

  const reset = useCallback(() => {
    for (const url of previews.current) URL.revokeObjectURL(url);
    previews.current.clear();
    files.current.clear();
    setPhotos([]);
  }, []);

  // Never leak object URLs when the dialog unmounts mid-selection.
  useEffect(() => reset, [reset]);

  const pathnames = photos.flatMap((photo) =>
    photo.status === "uploaded" && photo.pathname ? [photo.pathname] : [],
  );

  return {
    photos,
    pathnames,
    uploading: photos.some((photo) => photo.status === "uploading"),
    hasErrors: photos.some((photo) => photo.status === "error"),
    full: photos.length >= EVIDENCE_PHOTO_MAX_COUNT,
    add,
    retry,
    remove,
    reset,
  };
}
