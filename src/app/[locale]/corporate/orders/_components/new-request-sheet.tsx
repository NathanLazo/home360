"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { RequestPhotoPicker } from "./request-photo-picker";
import {
  useRequestPhotoUpload,
  type PhotoUploadFailure,
} from "./use-request-photo-upload";
import { useErrorShake } from "~/components/motion";
import { SheetFormDock } from "~/components/sheet-form-dock";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Textarea } from "~/components/ui/textarea";
import { REQUEST_CATEGORIES } from "~/schemas/marketplace/request-categories";
import {
  corporateRequestCreateSchema,
  type CorporateRequestCreateInput,
} from "~/server/api/schemas/corporate";

type FieldKey = "corporateLocationId" | "category" | "description";
type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_IDS: Record<FieldKey, string> = {
  corporateLocationId: "new-request-location",
  category: "new-request-category",
  description: "new-request-description",
};

function isFieldKey(key: PropertyKey): key is FieldKey {
  return (
    key === "corporateLocationId" || key === "category" || key === "description"
  );
}

export type NewRequestSheetProps = {
  open: boolean;
  locations: Array<{ id: string; name: string }>;
  defaultLocationId?: string;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CorporateRequestCreateInput) => Promise<boolean>;
};

/**
 * "Nueva solicitud" (F7 corporate consumer): location, category, description
 * and optional photos. Only ACTIVE locations are offered; businesses then
 * quote it from their radar and the offers appear in the requests list.
 */
export function NewRequestSheet({
  open,
  locations,
  defaultLocationId,
  submitting,
  onOpenChange,
  onSubmit,
}: NewRequestSheetProps) {
  const t = useTranslations("corporate.orders.newRequest");
  const categoryT = useTranslations("corporate.requestCategory");
  const photos = useRequestPhotoUpload();
  const shakeInvalid = useErrorShake();
  const [locationId, setLocationId] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [photoError, setPhotoError] = useState<PhotoUploadFailure | null>(null);
  const busy = submitting || photos.uploading;
  const resetPhotos = photos.reset;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setPhotoError(null);
    setCategory("");
    setDescription("");
    resetPhotos();
    setLocationId(
      locations.some(({ id }) => id === defaultLocationId)
        ? (defaultLocationId ?? "")
        : (locations[0]?.id ?? ""),
    );
    // Reset only when the sheet opens; the lists are stable while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = corporateRequestCreateSchema.safeParse({
      corporateLocationId: locationId,
      category,
      description,
      mediaPathnames: photos.photos.map((photo) => photo.pathname),
    });

    if (!parsed.success) {
      const next: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const key = issue.path[0];

        if (key !== undefined && isFieldKey(key)) {
          next[key] = t(`validation.${key}`);
        }
      }

      setErrors(next);
      shakeInvalid(form);
      const first = parsed.error.issues[0]?.path[0];

      if (first !== undefined && isFieldKey(first)) {
        window.requestAnimationFrame(() =>
          document.getElementById(FIELD_IDS[first])?.focus(),
        );
      }

      return;
    }

    setErrors({});

    if (await onSubmit(parsed.data)) {
      onOpenChange(false);
    }
  }

  function errorFor(key: FieldKey) {
    return errors[key] ? (
      <p
        id={`${FIELD_IDS[key]}-error`}
        role="alert"
        className="text-error-deep text-xs"
      >
        {errors[key]}
      </p>
    ) : null;
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <SheetContent showCloseButton={false} className="w-full sm:max-w-lg">
        <SheetHeader className="border-b pr-14">
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label={t("close")}
              disabled={busy}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-1 flex-col gap-4 p-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.corporateLocationId}>
                {t("location")}
              </Label>
              <Select
                value={locationId}
                onValueChange={(value) => {
                  setLocationId(value);
                  setErrors({});
                }}
                disabled={busy}
              >
                <SelectTrigger
                  id={FIELD_IDS.corporateLocationId}
                  className="w-full"
                  aria-invalid={Boolean(errors.corporateLocationId)}
                >
                  <SelectValue placeholder={t("locationPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errorFor("corporateLocationId")}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.category}>{t("category")}</Label>
              <Select
                value={category}
                onValueChange={(value) => {
                  setCategory(value);
                  setErrors({});
                }}
                disabled={busy}
              >
                <SelectTrigger
                  id={FIELD_IDS.category}
                  className="w-full"
                  aria-invalid={Boolean(errors.category)}
                >
                  <SelectValue placeholder={t("categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {categoryT(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errorFor("category")}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={FIELD_IDS.description}>{t("details")}</Label>
              <Textarea
                id={FIELD_IDS.description}
                value={description}
                rows={5}
                placeholder={t("detailsPlaceholder")}
                disabled={busy}
                aria-invalid={Boolean(errors.description)}
                aria-describedby={
                  errors.description
                    ? `${FIELD_IDS.description}-error`
                    : undefined
                }
                onChange={(event) => {
                  setDescription(event.target.value);
                  setErrors({});
                }}
              />
              {errorFor("description")}
            </div>
            <RequestPhotoPicker
              photos={photos.photos}
              uploading={photos.uploading}
              disabled={submitting}
              error={photoError}
              onPick={(files) => {
                void photos.upload(files).then(setPhotoError);
              }}
              onRemove={photos.remove}
            />
          </div>
          <SheetFormDock>
            <SheetClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                {t("cancel")}
              </Button>
            </SheetClose>
            <Button type="submit" metal="live" disabled={busy}>
              {submitting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("submit")}
            </Button>
          </SheetFormDock>
        </form>
      </SheetContent>
    </Sheet>
  );
}
