"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  workerCreateFormSchema,
  workerUpdateFormSchema,
  type WorkerCreateFormInput,
  type WorkerUpdateFormInput,
} from "./team.schema";
import type {
  BranchOption,
  WorkerFormErrors,
  WorkerFormValues,
  WorkerListItem,
} from "./team.types";
import { WorkerFormFields } from "./worker-form-fields";
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

const EMPTY_VALUES: WorkerFormValues = {
  fullName: "",
  specialty: "",
  invitedEmail: "",
  branchId: "",
};

function toFormValues(worker: WorkerListItem | null): WorkerFormValues {
  if (!worker) return EMPTY_VALUES;

  return {
    fullName: worker.fullName,
    specialty: worker.specialty ?? "",
    invitedEmail: worker.invitedEmail ?? "",
    branchId: worker.branch?.id ?? "",
  };
}

export function WorkerFormSheet({
  open,
  worker,
  branches,
  submitting,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  worker: WorkerListItem | null;
  branches: BranchOption[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: WorkerCreateFormInput) => Promise<boolean>;
  onUpdate: (input: WorkerUpdateFormInput) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.team");
  // A cancellation arriving mid-edit closes the form instead of letting the
  // user finish something the server will reject.
  useCloseWhenReadOnly(open, onOpenChange);
  const initialValues = toFormValues(worker);
  const [values, setValues] = useState<WorkerFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<WorkerFormErrors>({});
  const isEditing = worker !== null;
  const isDirty =
    values.fullName !== initialValues.fullName ||
    values.specialty !== initialValues.specialty ||
    values.branchId !== initialValues.branchId;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(toFormValues(worker));
  }, [open, worker]);

  function showValidationErrors(
    issues: ReadonlyArray<{ path: Array<PropertyKey> }>,
  ) {
    const next: WorkerFormErrors = {};
    for (const issue of issues) {
      const field = issue.path[0];
      if (
        field === "fullName" ||
        field === "specialty" ||
        field === "invitedEmail" ||
        field === "branchId"
      ) {
        next[field] =
          field === "invitedEmail"
            ? t("form.invalidEmail")
            : t("form.invalidField");
      }
    }
    setErrors(next);
    const first = issues[0]?.path[0];
    const targetId =
      first === "fullName" ||
      first === "specialty" ||
      first === "invitedEmail" ||
      first === "branchId"
        ? `worker-${String(first)}`
        : "worker-fullName";
    window.requestAnimationFrame(() =>
      document
        .getElementById(
          targetId === "worker-branchId" ? "worker-branch" : targetId,
        )
        ?.focus(),
    );
  }

  const shakeInvalid = useErrorShake();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const branchId = values.branchId === "" ? null : values.branchId;
    const specialty = values.specialty.trim();

    if (worker) {
      const parsed = workerUpdateFormSchema.safeParse({
        id: worker.id,
        fullName: values.fullName,
        branchId,
        specialty: specialty === "" ? null : specialty,
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

    const invitedEmail = values.invitedEmail.trim();
    const parsed = workerCreateFormSchema.safeParse({
      fullName: values.fullName,
      branchId,
      ...(specialty === "" ? {} : { specialty }),
      ...(invitedEmail === "" ? {} : { invitedEmail }),
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        className="w-full sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          window.requestAnimationFrame(() =>
            document.getElementById("worker-fullName")?.focus(),
          );
        }}
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>
            {t(isEditing ? "form.editTitle" : "form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {t(isEditing ? "form.editDescription" : "form.createDescription")}
          </SheetDescription>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 min-h-11 min-w-11"
              aria-label={t("form.close")}
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
            <WorkerFormFields
              values={values}
              errors={errors}
              branches={branches}
              isEditing={isEditing}
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
                className="min-h-11"
              >
                {t("form.cancel")}
              </Button>
            </SheetClose>
            <Button
              type="submit"
              metal="live"
              disabled={submitting || (isEditing && !isDirty)}
              className="min-h-11"
            >
              {submitting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t(isEditing ? "form.save" : "form.create")}
            </Button>
          </SheetFormDock>
        </form>
      </SheetContent>
    </Sheet>
  );
}
