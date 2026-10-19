"use client";

import { useId, useRef, useState, type ChangeEvent } from "react";
import {
  CircleCheckIcon,
  ImagePlusIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  EVIDENCE_PHOTO_MAX_COUNT,
  EVIDENCE_PHOTO_TYPES,
  type EvidencePhoto,
  type EvidencePhotoFailure,
  type useDeliveryEvidenceUpload,
} from "./use-delivery-evidence-upload";
import { Button } from "~/components/ui/button";

type EvidenceUpload = ReturnType<typeof useDeliveryEvidenceUpload>;

function useFailureLabel() {
  const t = useTranslations("dashboard.orders.actions.deliveredDialog");
  const errorsT = useTranslations("errors");

  return (failure: EvidencePhotoFailure) => {
    if (failure.kind === "code") return errorsT(failure.code);
    return t(`photoErrors.${failure.kind}`);
  };
}

function EvidenceTile({
  photo,
  number,
  disabled,
  onRetry,
  onRemove,
}: {
  photo: EvidencePhoto;
  number: number;
  disabled: boolean;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations("dashboard.orders.actions.deliveredDialog");
  const failureLabel = useFailureLabel();
  const statusId = useId();
  const label = t("photoLabel", { number });

  return (
    <li className="flex flex-col gap-1.5" aria-describedby={statusId}>
      <div className="bg-canvas-soft relative overflow-hidden rounded-xl border">
        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, never optimizable. */}
        <img
          src={photo.previewUrl}
          alt={label}
          className={
            photo.status === "uploaded"
              ? "aspect-square w-full object-cover"
              : "aspect-square w-full object-cover opacity-60"
          }
        />
        <Button
          type="button"
          variant="secondary"
          size="icon-xs"
          className="absolute top-1.5 right-1.5"
          aria-label={t("removePhoto", { label })}
          disabled={disabled}
          onClick={onRemove}
        >
          <XIcon aria-hidden="true" />
        </Button>
        {photo.status === "uploading" ? (
          <div
            role="progressbar"
            aria-label={t("uploadingPhoto", { label })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={photo.progress}
            className="bg-tint-sky-soft absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full"
          >
            <div
              className="bg-tint-sky h-full origin-left rounded-full transition-transform duration-150 ease-out motion-reduce:transition-none"
              style={{ transform: `scaleX(${photo.progress / 100})` }}
            />
          </div>
        ) : null}
      </div>
      <p
        id={statusId}
        className="text-copy-sm flex min-h-5 items-start gap-1 text-xs"
      >
        {photo.status === "uploading" ? (
          <span className="text-muted-foreground tabular-nums">
            {t("progress", { percent: photo.progress })}
          </span>
        ) : null}
        {photo.status === "uploaded" ? (
          <span className="text-success-deep inline-flex items-center gap-1">
            <CircleCheckIcon aria-hidden="true" className="size-3.5" />
            {t("uploaded")}
          </span>
        ) : null}
        {photo.status === "error" && photo.failure ? (
          <span className="text-error-deep inline-flex items-start gap-1">
            <TriangleAlertIcon
              aria-hidden="true"
              className="mt-px size-3.5 shrink-0"
            />
            {failureLabel(photo.failure)}
          </span>
        ) : null}
      </p>
      {photo.status === "error" &&
      photo.failure &&
      (photo.failure.kind === "upload" || photo.failure.kind === "code") ? (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="self-start"
          disabled={disabled}
          onClick={onRetry}
        >
          <RotateCcwIcon aria-hidden="true" />
          {t("retryPhoto")}
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Photo picker of the "Marcar entregado" dialog: 1–10 images, each with its
 * own thumbnail, progress and error (retry in place). Keyboard users reach
 * the native file input through the visible "Agregar fotos" button.
 */
export function DeliveryEvidenceUploader({
  upload,
  disabled,
}: {
  upload: EvidenceUpload;
  disabled: boolean;
}) {
  const t = useTranslations("dashboard.orders.actions.deliveredDialog");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();
  const [overflow, setOverflow] = useState(0);
  const uploadedCount = upload.pathnames.length;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    // Reset so picking the same file again (after removing it) re-fires.
    event.target.value = "";
    if (selected.length === 0) return;
    setOverflow(upload.add(selected));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-copy-sm font-medium">
          {t("photosLabel")}
        </label>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {t("photoCount", {
            count: upload.photos.length,
            max: EVIDENCE_PHOTO_MAX_COUNT,
          })}
        </span>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={EVIDENCE_PHOTO_TYPES.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        disabled={disabled || upload.full}
        aria-describedby={hintId}
        onChange={handleChange}
      />

      {upload.photos.length > 0 ? (
        <ul
          className="grid grid-cols-3 gap-3 sm:grid-cols-4"
          aria-label={t("photosListLabel")}
        >
          {upload.photos.map((photo, index) => (
            <EvidenceTile
              key={photo.id}
              photo={photo}
              number={index + 1}
              disabled={disabled}
              onRetry={() => upload.retry(photo.id)}
              onRemove={() => upload.remove(photo.id)}
            />
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={disabled || upload.full}
        aria-describedby={hintId}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlusIcon aria-hidden="true" />
        {t(upload.photos.length > 0 ? "addMorePhotos" : "addPhotos")}
      </Button>

      <p id={hintId} className="text-muted-foreground text-xs">
        {t("photosHint", { max: EVIDENCE_PHOTO_MAX_COUNT })}
      </p>
      {overflow > 0 ? (
        <p role="alert" className="text-warning-deep text-xs">
          {t("photosOverflow", {
            count: overflow,
            max: EVIDENCE_PHOTO_MAX_COUNT,
          })}
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {t("uploadedStatus", {
          uploaded: uploadedCount,
          total: upload.photos.length,
        })}
      </p>
    </div>
  );
}
