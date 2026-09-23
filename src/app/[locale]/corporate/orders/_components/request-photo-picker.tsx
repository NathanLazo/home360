"use client";

import { useId, useRef } from "react";
import { ImagePlusIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  REQUEST_PHOTO_MAX_COUNT,
  REQUEST_PHOTO_TYPES,
  type PhotoUploadFailure,
  type UploadedPhoto,
} from "./use-request-photo-upload";
import { Button } from "~/components/ui/button";

export type RequestPhotoPickerProps = {
  photos: UploadedPhoto[];
  uploading: boolean;
  disabled: boolean;
  error: PhotoUploadFailure | null;
  onPick: (files: File[]) => void;
  onRemove: (pathname: string) => void;
};

/** Optional evidence photos of the request (JPG/PNG/WebP, up to five). */
export function RequestPhotoPicker({
  photos,
  uploading,
  disabled,
  error,
  onPick,
  onRemove,
}: RequestPhotoPickerProps) {
  const t = useTranslations("corporate.orders.newRequest.photos");
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const errorId = useId();
  const full = photos.length >= REQUEST_PHOTO_MAX_COUNT;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("label")}</span>
      <p id={hintId} className="text-muted-foreground text-xs">
        {t("hint", { max: REQUEST_PHOTO_MAX_COUNT })}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={REQUEST_PHOTO_TYPES.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";

          if (files.length > 0) {
            onPick(files);
          }
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11 self-start"
        disabled={disabled || uploading || full}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <LoaderCircleIcon
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : (
          <ImagePlusIcon aria-hidden="true" />
        )}
        {uploading ? t("uploading") : t("add")}
      </Button>
      {error ? (
        <p id={errorId} role="alert" className="text-error-deep text-xs">
          {t(`errors.${error}`, { max: REQUEST_PHOTO_MAX_COUNT })}
        </p>
      ) : null}
      {photos.length > 0 ? (
        <ul className="flex flex-col gap-1" aria-label={t("listLabel")}>
          {photos.map((photo) => (
            <li
              key={photo.pathname}
              className="bg-canvas-soft text-copy-sm flex items-center justify-between gap-2 rounded-md px-3 py-1.5"
            >
              <span className="min-w-0 truncate">{photo.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                disabled={disabled}
                aria-label={t("remove", { name: photo.name })}
                onClick={() => onRemove(photo.pathname)}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
