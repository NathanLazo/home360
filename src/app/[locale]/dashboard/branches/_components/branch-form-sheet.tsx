"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { BranchFormFields } from "./branch-form-fields";
import {
  branchCreateSchema,
  branchUpdateSchema,
  type BranchCreateInput,
  type BranchUpdateInput,
} from "./branch.schema";
import type {
  BranchFormErrors,
  BranchFormValues,
  BranchListItem,
} from "./branch.types";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
import { SheetFormDock } from "~/components/sheet-form-dock";
import { Button } from "~/components/ui/button";
import { useErrorShake } from "~/components/motion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { parseCoordinate } from "~/lib/geo-coordinates";

const EMPTY_VALUES: BranchFormValues = {
  name: "",
  address: "",
  managerName: "",
  coverageRadiusKm: "10",
  latitude: "",
  longitude: "",
};


export function BranchFormSheet({
  open,
  branch,
  submitting,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  branch: BranchListItem | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: BranchCreateInput) => Promise<boolean>;
  onUpdate: (input: BranchUpdateInput) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.branches");
  const tGeo = useTranslations("common.geoLocation");
  // A cancellation arriving mid-edit closes the form instead of letting the
  // user finish something the server will reject.
  useCloseWhenReadOnly(open, onOpenChange);
  const [values, setValues] = useState<BranchFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<BranchFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      branch
        ? {
            name: branch.name,
            address: branch.address,
            managerName: branch.managerName ?? "",
            coverageRadiusKm: String(branch.coverageRadiusKm),
            latitude: branch.latitude === null ? "" : String(branch.latitude),
            longitude:
              branch.longitude === null ? "" : String(branch.longitude),
          }
        : EMPTY_VALUES,
    );
  }, [branch, open]);

  function showValidationErrors(
    issues: ReadonlyArray<{ path: Array<PropertyKey> }>,
  ) {
    const next: BranchFormErrors = {};
    for (const issue of issues) {
      const key = issue.path[0];
      if (
        key === "name" ||
        key === "address" ||
        key === "managerName" ||
        key === "coverageRadiusKm" ||
        key === "latitude" ||
        key === "longitude"
      ) {
        next[key] =
          key === "latitude" || key === "longitude"
            ? tGeo("invalid")
            : t("form.invalidField");
      }
    }
    setErrors(next);
    const first = issues[0]?.path[0];
    const ids: Partial<Record<PropertyKey, string>> = {
      name: "branch-name",
      address: "branch-address",
      managerName: "branch-manager",
      coverageRadiusKm: "branch-coverage",
      latitude: "branch-latitude",
      longitude: "branch-longitude",
    };
    const target = first === undefined ? undefined : ids[first];
    if (target)
      window.requestAnimationFrame(() =>
        document.getElementById(target)?.focus(),
      );
  }

  const shakeInvalid = useErrorShake();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const common = {
      name: values.name,
      address: values.address,
      coverageRadiusKm: Number(values.coverageRadiusKm),
    };
    const latitude = parseCoordinate(values.latitude);
    const longitude = parseCoordinate(values.longitude);

    if (branch) {
      const parsed = branchUpdateSchema.safeParse({
        id: branch.id,
        ...common,
        managerName: values.managerName.trim() ? values.managerName : null,
        latitude,
        longitude,
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

    const parsed = branchCreateSchema.safeParse({
      ...common,
      ...(values.managerName.trim() ? { managerName: values.managerName } : {}),
      ...(latitude !== null ? { latitude } : {}),
      ...(longitude !== null ? { longitude } : {}),
    });
    if (!parsed.success) {
      showValidationErrors(parsed.error.issues);
      shakeInvalid(formElement);
      return;
    }
    setErrors({});
    if (await onCreate(parsed.data)) onOpenChange(false);
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
            document.getElementById("branch-name")?.focus(),
          );
        }}
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>
            {t(branch ? "form.editTitle" : "form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {t(branch ? "form.editDescription" : "form.createDescription")}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3"
              aria-label={t("form.close")}
              disabled={submitting}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="flex-1 py-4">
            <BranchFormFields
              values={values}
              errors={errors}
              disabled={submitting}
              onChange={setValues}
            />
          </div>
          <SheetFormDock>
            <SheetClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
              >
                {t("form.cancel")}
              </Button>
            </SheetClose>
            <Button
              type="submit"
              metal="live"
              disabled={submitting}
            >
              {submitting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t(branch ? "form.save" : "form.create")}
            </Button>
          </SheetFormDock>
        </form>
      </SheetContent>
    </Sheet>
  );
}
