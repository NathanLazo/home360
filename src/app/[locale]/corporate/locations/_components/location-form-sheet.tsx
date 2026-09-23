"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CorporateLocationItem } from "../../_components/corporate.types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useErrorShake } from "~/components/motion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import type {
  CorporateLocationCreateInput,
  CorporateLocationUpdateInput,
} from "~/server/api/schemas/corporate";
import {
  corporateLocationCreateSchema,
  corporateLocationUpdateSchema,
} from "~/server/api/schemas/corporate";

type LocationFormValues = {
  name: string;
  addressLine: string;
  city: string;
  contactName: string;
  contactPhone: string;
};

type FieldKey = keyof LocationFormValues;

type LocationFormErrors = Partial<Record<FieldKey, string>>;

const EMPTY_VALUES: LocationFormValues = {
  name: "",
  addressLine: "",
  city: "",
  contactName: "",
  contactPhone: "",
};

const FIELD_IDS: Record<FieldKey, string> = {
  name: "location-name",
  addressLine: "location-address",
  city: "location-city",
  contactName: "location-contact-name",
  contactPhone: "location-contact-phone",
};

function isFieldKey(key: PropertyKey): key is FieldKey {
  return (
    key === "name" ||
    key === "addressLine" ||
    key === "city" ||
    key === "contactName" ||
    key === "contactPhone"
  );
}

export function LocationFormSheet({
  open,
  location,
  submitting,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  location: CorporateLocationItem | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CorporateLocationCreateInput) => Promise<boolean>;
  onUpdate: (input: CorporateLocationUpdateInput) => Promise<boolean>;
}) {
  const t = useTranslations("corporate.locations.form");
  const [values, setValues] = useState<LocationFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<LocationFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      location
        ? {
            name: location.name,
            addressLine: location.addressLine,
            city: location.city,
            contactName: location.contactName ?? "",
            contactPhone: location.contactPhone ?? "",
          }
        : EMPTY_VALUES,
    );
  }, [location, open]);

  function showValidationErrors(
    issues: ReadonlyArray<{ path: Array<PropertyKey> }>,
  ) {
    const next: LocationFormErrors = {};
    for (const issue of issues) {
      const key = issue.path[0];
      if (key !== undefined && isFieldKey(key)) {
        next[key] = t(`validation.${key}`);
      }
    }
    setErrors(next);
    const first = issues[0]?.path[0];
    if (first !== undefined && isFieldKey(first)) {
      window.requestAnimationFrame(() =>
        document.getElementById(FIELD_IDS[first])?.focus(),
      );
    }
  }

  const shakeInvalid = useErrorShake();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const common = {
      name: values.name,
      addressLine: values.addressLine,
      city: values.city,
    };

    if (location) {
      const parsed = corporateLocationUpdateSchema.safeParse({
        locationId: location.id,
        ...common,
        contactName: values.contactName.trim() ? values.contactName : null,
        contactPhone: values.contactPhone.trim() ? values.contactPhone : null,
      });
      if (!parsed.success) {
        showValidationErrors(parsed.error.issues);
        shakeInvalid(formElement);
        return;
      }
      setErrors({});
      if (await onUpdate(parsed.data)) onOpenChange(false);
      return;
    }

    const parsed = corporateLocationCreateSchema.safeParse({
      ...common,
      ...(values.contactName.trim() ? { contactName: values.contactName } : {}),
      ...(values.contactPhone.trim()
        ? { contactPhone: values.contactPhone }
        : {}),
    });
    if (!parsed.success) {
      showValidationErrors(parsed.error.issues);
      shakeInvalid(formElement);
      return;
    }
    setErrors({});
    if (await onCreate(parsed.data)) onOpenChange(false);
  }

  function field(
    key: FieldKey,
    options: { optional?: boolean; autoComplete?: string } = {},
  ) {
    const errorId = `${FIELD_IDS[key]}-error`;

    return (
      <div className="flex flex-col gap-2 px-4">
        <Label htmlFor={FIELD_IDS[key]}>
          {t(key)}
          {options.optional ? (
            <span className="text-muted-foreground text-xs font-normal">
              ({t("optional")})
            </span>
          ) : null}
        </Label>
        <Input
          id={FIELD_IDS[key]}
          value={values[key]}
          autoComplete={options.autoComplete}
          disabled={submitting}
          aria-invalid={errors[key] !== undefined}
          aria-describedby={errors[key] !== undefined ? errorId : undefined}
          onChange={(event) =>
            setValues((current) => ({ ...current, [key]: event.target.value }))
          }
        />
        {errors[key] !== undefined ? (
          <p id={errorId} className="text-error-deep text-xs">
            {errors[key]}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <SheetContent
        showCloseButton={false}
        className="w-full sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.requestAnimationFrame(() =>
            document.getElementById(FIELD_IDS.name)?.focus(),
          );
        }}
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>{t(location ? "editTitle" : "createTitle")}</SheetTitle>
          <SheetDescription>
            {t(location ? "editDescription" : "createDescription")}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 min-h-11 min-w-11"
              aria-label={t("close")}
              disabled={submitting}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
            {field("name", { autoComplete: "organization" })}
            {field("addressLine", { autoComplete: "street-address" })}
            {field("city", { autoComplete: "address-level2" })}
            {field("contactName", { optional: true, autoComplete: "name" })}
            {field("contactPhone", { optional: true, autoComplete: "tel" })}
          </div>
          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            <SheetClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="min-h-11"
              >
                {t("cancel")}
              </Button>
            </SheetClose>
            <Button type="submit" disabled={submitting} className="min-h-11">
              {submitting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t(location ? "save" : "create")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
