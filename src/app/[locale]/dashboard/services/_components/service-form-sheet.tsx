"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ServiceFormFields } from "./service-form-fields";
import {
  serviceCreateSchema,
  serviceUpdateSchema,
  type ServiceCreateInput,
  type ServiceUpdateInput,
} from "./service.schema";
import type {
  ServiceFormErrors,
  ServiceFormValues,
  ServiceListItem,
  ServiceWorker,
} from "./service.types";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
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

const EMPTY_VALUES: ServiceFormValues = {
  name: "",
  category: "",
  price: "",
  duration: "",
  durationMax: "",
  workerIds: [],
};

export function ServiceFormSheet({
  open,
  service,
  categories,
  workers,
  submitting,
  onOpenChange,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  service: ServiceListItem | null;
  categories: string[];
  workers: ServiceWorker[];
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: ServiceCreateInput) => Promise<boolean>;
  onUpdate: (input: ServiceUpdateInput) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.services");
  // A cancellation arriving mid-edit closes the form instead of letting the
  // user finish something the server will reject.
  useCloseWhenReadOnly(open, onOpenChange);
  const [values, setValues] = useState<ServiceFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<ServiceFormErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues(
      service
        ? {
            name: service.name,
            category: service.category,
            price: String(service.basePriceCents / 100),
            duration: String(service.durationMinutes),
            durationMax: service.durationMaxMinutes
              ? String(service.durationMaxMinutes)
              : "",
            workerIds: service.workers.map((worker) => worker.id),
          }
        : EMPTY_VALUES,
    );
  }, [open, service]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const common = {
      name: values.name,
      category: values.category,
      basePriceCents: Math.round(Number(values.price) * 100),
      durationMinutes: Number(values.duration),
      workerIds: values.workerIds,
    };
    function showValidationErrors(
      issues: ReadonlyArray<{ path: Array<PropertyKey> }>,
    ) {
      const next: ServiceFormErrors = {};
      for (const issue of issues) {
        const field = issue.path[0];
        if (field === "basePriceCents") next.price = t("form.invalidField");
        else if (field === "durationMinutes")
          next.duration = t("form.invalidField");
        else if (field === "durationMaxMinutes")
          next.durationMax = t("form.durationRangeError");
        else if (
          field === "name" ||
          field === "category" ||
          field === "workerIds"
        )
          next[field] = t("form.invalidField");
      }
      setErrors(next);
      const firstField = issues[0]?.path[0];
      const targetId =
        firstField === "basePriceCents"
          ? "service-price"
          : firstField === "durationMinutes"
            ? "service-duration"
            : firstField === "durationMaxMinutes"
              ? "service-duration-max"
              : firstField === "workerIds"
                ? "service-workers-search"
                : firstField === "name" || firstField === "category"
                  ? `service-${firstField}`
                  : null;
      if (targetId) {
        window.requestAnimationFrame(() =>
          document.getElementById(targetId)?.focus(),
        );
      }
    }

    if (service) {
      const parsed = serviceUpdateSchema.safeParse({
        id: service.id,
        ...common,
        durationMaxMinutes: values.durationMax
          ? Number(values.durationMax)
          : null,
      });
      if (!parsed.success) {
        showValidationErrors(parsed.error.issues);
        return;
      }
      setErrors({});
      if (await onUpdate(parsed.data)) onOpenChange(false);
      return;
    }

    const parsed = serviceCreateSchema.safeParse({
      ...common,
      ...(values.durationMax
        ? { durationMaxMinutes: Number(values.durationMax) }
        : {}),
    });
    if (!parsed.success) {
      showValidationErrors(parsed.error.issues);
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
            document.getElementById("service-name")?.focus(),
          );
        }}
      >
        <SheetHeader className="border-b pr-14">
          <SheetTitle>
            {t(service ? "form.editTitle" : "form.createTitle")}
          </SheetTitle>
          <SheetDescription>
            {t(service ? "form.editDescription" : "form.createDescription")}
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
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <ServiceFormFields
              values={values}
              errors={errors}
              categories={categories}
              workers={workers}
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
              {t(service ? "form.save" : "form.create")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
