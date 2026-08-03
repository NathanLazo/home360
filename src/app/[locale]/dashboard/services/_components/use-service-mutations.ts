"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { ServiceCreateInput, ServiceUpdateInput } from "./service.schema";
import type { ServiceListItem } from "./service.types";
import { api } from "~/trpc/react";

type OperationResponse = {
  result: object | null;
  error: string | null;
};

export function useServiceMutations() {
  const t = useTranslations("dashboard.services");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const createMutation = api.service.create.useMutation();
  const updateMutation = api.service.update.useMutation();
  const statusMutation = api.service.setStatus.useMutation();
  const deleteMutation = api.service.delete.useMutation();

  async function finish(
    response: OperationResponse,
    successMessage: string,
    conflictMessage?: string,
  ): Promise<boolean> {
    if (response.error !== null || response.result === null) {
      toast.error(
        response.error === "CONFLICT" && conflictMessage
          ? conflictMessage
          : response.error
            ? errors(response.error)
            : t("feedback.transportError"),
      );
      return false;
    }

    toast.success(successMessage);
    await Promise.all([
      utils.service.list.invalidate(),
      utils.service.listCategories.invalidate(),
    ]);
    return true;
  }

  async function create(input: ServiceCreateInput): Promise<boolean> {
    try {
      return await finish(
        await createMutation.mutateAsync(input),
        t("feedback.created"),
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  async function update(input: ServiceUpdateInput): Promise<boolean> {
    try {
      return await finish(
        await updateMutation.mutateAsync(input),
        t("feedback.updated"),
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  async function setStatus(
    id: string,
    status: ServiceListItem["status"],
  ): Promise<boolean> {
    try {
      return await finish(
        await statusMutation.mutateAsync({ id, status }),
        t(status === "ACTIVE" ? "feedback.activated" : "feedback.paused"),
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      return await finish(
        await deleteMutation.mutateAsync({ id }),
        t("feedback.deleted"),
        t("feedback.deleteConflict"),
      );
    } catch {
      toast.error(t("feedback.transportError"));
      return false;
    }
  }

  return {
    create,
    update,
    setStatus,
    remove,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    changingStatus: statusMutation.isPending,
    deleting: deleteMutation.isPending,
  };
}
