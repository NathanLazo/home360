"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import type { WorkerOption } from "./order.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function OrderAssignWorkerDialog({
  open,
  folio,
  currentWorkerId,
  workers,
  loading,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  folio: number;
  currentWorkerId: string | null;
  workers: WorkerOption[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (workerId: string) => void;
}) {
  const t = useTranslations("dashboard.orders.actions.assignDialog");
  const [workerId, setWorkerId] = useState("");
  const fieldId = useId();

  useEffect(() => {
    if (open) setWorkerId(currentWorkerId ?? "");
  }, [open, currentWorkerId]);

  const unchanged = workerId === "" || workerId === currentWorkerId;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(currentWorkerId ? "reassignTitle" : "title", { folio })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId}>{t("workerLabel")}</Label>
          {workers.length > 0 ? (
            <Select
              value={workerId}
              onValueChange={setWorkerId}
              disabled={loading}
            >
              <SelectTrigger id={fieldId} className="w-full">
                <SelectValue placeholder={t("workerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {workers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-muted-foreground text-copy-sm">
              {t("noWorkers")}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || unchanged}
            aria-busy={loading || undefined}
            onClick={(event) => {
              event.preventDefault();
              if (!unchanged) onConfirm(workerId);
            }}
          >
            {loading ? (
              <LoaderCircleIcon
                data-icon="inline-start"
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
