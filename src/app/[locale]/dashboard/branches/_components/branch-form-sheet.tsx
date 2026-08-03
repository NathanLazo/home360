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
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

const EMPTY_VALUES: BranchFormValues = {
  name: "",
  address: "",
  managerName: "",
  coverageRadiusKm: "10",
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
        key === "coverageRadiusKm"
      ) {
        next[key] = t("form.invalidField");
      }
    }
    setErrors(next);
    const first = issues[0]?.path[0];
    const ids: Partial<Record<PropertyKey, string>> = {
      name: "branch-name",
      address: "branch-address",
      managerName: "branch-manager",
      coverageRadiusKm: "branch-coverage",
    };
    const target = first === undefined ? undefined : ids[first];
    if (target)
      window.requestAnimationFrame(() =>
        document.getElementById(target)?.focus(),
      );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const common = {
      name: values.name,
      address: values.address,
      coverageRadiusKm: Number(values.coverageRadiusKm),
    };

    if (branch) {
      const parsed = branchUpdateSchema.safeParse({
        id: branch.id,
        ...common,
        managerName: values.managerName.trim() ? values.managerName : null,
      });
      if (!parsed.success) {
        showValidationErrors(parsed.error.issues);
        return;
      }
      setErrors({});
      if (await onUpdate(parsed.data)) onOpenChange(false);
      return;
    }

    const parsed = branchCreateSchema.safeParse({
      ...common,
      ...(values.managerName.trim() ? { managerName: values.managerName } : {}),
    });
    if (!parsed.success) {
      showValidationErrors(parsed.error.issues);
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
              className="absolute top-3 right-3 min-h-11 min-w-11"
              aria-label={t("form.close")}
              disabled={submitting}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <BranchFormFields
              values={values}
              errors={errors}
              disabled={submitting}
              onChange={setValues}
            />
          </div>
          <SheetFooter className="border-t sm:flex-row sm:justify-end">
            <SheetClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="min-h-11"
              >
                {t("form.cancel")}
              </Button>
            </SheetClose>
            <Button type="submit" disabled={submitting} className="min-h-11">
              {submitting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t(branch ? "form.save" : "form.create")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
