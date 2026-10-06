"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircleIcon, RotateCcwIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { BranchUpdateInput } from "./branch.schema";
import type { BranchListItem } from "./branch.types";
import { useCloseWhenReadOnly } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

const NO_MANAGER = "__none__";

/**
 * "Asignar encargado": picks the manager from the team. The branch keeps
 * `managerName` as the display value, so a manager who later leaves the team
 * still reads correctly on the card.
 */
export function BranchManagerDialog({
  branch,
  submitting,
  onOpenChange,
  onSubmit,
}: {
  branch: BranchListItem | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: BranchUpdateInput) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.branches.managerDialog");
  const errorsT = useTranslations("errors");
  const open = branch !== null;
  useCloseWhenReadOnly(open, onOpenChange);
  const teamQuery = api.team.list.useQuery(undefined, { enabled: open });
  const teamItems = teamQuery.data?.result?.items;
  const workers = teamItems ?? [];
  const responseError = teamQuery.data?.error ?? null;
  const [selected, setSelected] = useState(NO_MANAGER);

  // Re-seed when the dialog targets another branch or the team loads.
  useEffect(() => {
    if (!branch) return;
    const match = teamItems?.find(
      (worker) => worker.fullName === branch.managerName,
    );
    setSelected(match?.id ?? NO_MANAGER);
  }, [branch, teamItems]);

  const sameBranch = workers.filter(
    (worker) => worker.branch?.id === branch?.id,
  );
  const otherBranches = workers.filter(
    (worker) => worker.branch?.id !== branch?.id,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!branch) return;
    const worker = workers.find(({ id }) => id === selected);
    if (
      await onSubmit({ id: branch.id, managerName: worker?.fullName ?? null })
    ) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>
              {t("description", { name: branch?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>

          {teamQuery.isPending ? (
            <div className="flex h-16 items-center justify-center">
              <LoaderCircleIcon
                className="animate-spin motion-reduce:animate-none"
                aria-label={t("loading")}
              />
            </div>
          ) : teamQuery.error || responseError ? (
            <div role="alert" className="flex flex-col items-start gap-3">
              <p className="text-copy-sm text-muted-foreground">
                {responseError ? errorsT(responseError) : t("loadError")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void teamQuery.refetch()}
              >
                <RotateCcwIcon aria-hidden="true" />
                {t("retry")}
              </Button>
            </div>
          ) : workers.length === 0 ? (
            <div className="text-muted-foreground text-copy-sm flex items-start gap-3 rounded-xl border border-dashed p-4">
              <UsersIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>{t("emptyTeam")}</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="branch-manager-select">{t("label")}</Label>
              <Select
                value={selected}
                onValueChange={setSelected}
                disabled={submitting}
              >
                <SelectTrigger id="branch-manager-select" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MANAGER}>{t("none")}</SelectItem>
                  {sameBranch.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>{t("thisBranch")}</SelectLabel>
                      {sameBranch.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.fullName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {otherBranches.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>{t("otherBranches")}</SelectLabel>
                      {otherBranches.map((worker) => (
                        <SelectItem key={worker.id} value={worker.id}>
                          {worker.fullName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
              >
                {t("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={
                submitting || teamQuery.isPending || workers.length === 0
              }
            >
              {submitting ? (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : null}
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
