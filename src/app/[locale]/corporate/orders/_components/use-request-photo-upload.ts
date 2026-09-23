"use client";

import { useState } from "react";

import { api } from "~/trpc/react";

/** Same policy as the `requestPhoto` media kind (server re-validates). */
export const REQUEST_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const REQUEST_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const REQUEST_PHOTO_MAX_COUNT = 5;

export type UploadedPhoto = { pathname: string; name: string };

export type PhotoUploadFailure = "type" | "size" | "count" | "upload";

/**
 * Uploads request photos straight to private Blob storage through a scoped
 * presigned PUT (`media.createUploadUrl`, M0-W3): the file never transits the
 * app server, and only the returned pathname is sent with the request.
 */
export function useRequestPhotoUpload() {
  const createUploadUrl = api.media.createUploadUrl.useMutation();
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  async function upload(files: File[]): Promise<PhotoUploadFailure | null> {
    if (photos.length + files.length > REQUEST_PHOTO_MAX_COUNT) {
      return "count";
    }

    if (files.some((file) => !REQUEST_PHOTO_TYPES.includes(file.type))) {
      return "type";
    }

    if (files.some((file) => file.size > REQUEST_PHOTO_MAX_BYTES)) {
      return "size";
    }

    setUploading(true);

    try {
      const uploaded: UploadedPhoto[] = [];

      for (const file of files) {
        const grant = await createUploadUrl.mutateAsync({
          kind: "requestPhoto",
          contentType: file.type,
          sizeBytes: file.size,
        });

        if (grant.error !== null || !grant.result) {
          return "upload";
        }

        const response = await fetch(grant.result.uploadUrl, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });

        if (!response.ok) {
          return "upload";
        }

        uploaded.push({ pathname: grant.result.pathname, name: file.name });
      }

      setPhotos((current) => [...current, ...uploaded]);
      return null;
    } catch {
      return "upload";
    } finally {
      setUploading(false);
    }
  }

  function remove(pathname: string) {
    setPhotos((current) =>
      current.filter((photo) => photo.pathname !== pathname),
    );
  }

  function reset() {
    setPhotos([]);
  }

  return { photos, uploading, upload, remove, reset };
}
