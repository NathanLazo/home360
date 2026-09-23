"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { BranchCreateInput, BranchUpdateInput } from "./branch.schema";
import { api } from "~/trpc/react";

export function useBranchMutations() {
  const t = useTranslations("dashboard.branches.feedback");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const router = useRouter();

  async function refresh() {
    await Promise.all([
      utils.branch.list.invalidate(),
      utils.dashboard.getKpis.invalidate(),
      utils.dashboard.getWeeklyRevenue.invalidate(),
      utils.dashboard.getOrdersByBranch.invalidate(),
      utils.dashboard.getRecentOrders.invalidate(),
      utils.dashboard.getActiveOrdersCount.invalidate(),
    ]);
    // The header branch selector and sidebar read server-rendered shell data.
    router.refresh();
  }

  function failed(response: { error: string | null }) {
    if (!response.error) return false;
    toast.error(
      response.error === "PLAN_LIMIT" || response.error === "PLAN_LIMIT_REACHED"
        ? t("planLimit")
        : errors(response.error),
    );
    return true;
  }

  const createMutation = api.branch.create.useMutation();
  const updateMutation = api.branch.update.useMutation();
  const statusMutation = api.branch.setStatus.useMutation();
  const deleteMutation = api.branch.delete.useMutation();

  async function create(input: BranchCreateInput) {
    try {
      const response = await createMutation.mutateAsync(input);
      if (failed(response) || !response.result) return false;
      toast.success(t("created"));
      await refresh();
      return true;
    } catch {
      toast.error(t("createError"));
      return false;
    }
  }

  async function update(input: BranchUpdateInput) {
    try {
      const response = await updateMutation.mutateAsync(input);
      if (failed(response) || !response.result) return false;
      toast.success(t("updated"));
      await refresh();
      return true;
    } catch {
      toast.error(t("updateError"));
      return false;
    }
  }

  async function setStatus(id: string, status: "ACTIVE" | "PAUSED") {
    try {
      const response = await statusMutation.mutateAsync({ id, status });
      if (failed(response) || !response.result) return false;
      toast.success(t(status === "ACTIVE" ? "activated" : "paused"));
      await refresh();
      return true;
    } catch {
      toast.error(t("statusError"));
      return false;
    }
  }

  async function remove(id: string) {
    try {
      const response = await deleteMutation.mutateAsync({ id });
      if (response.error === "CONFLICT") {
        toast.error(t("deleteConflict"));
        return false;
      }
      if (failed(response) || !response.result) return false;
      toast.success(t("deleted"));
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get("branch") === id) {
        currentUrl.searchParams.delete("branch");
        const query = currentUrl.searchParams.toString();
        router.replace(
          `${currentUrl.pathname}${query ? `?${query}` : ""}${currentUrl.hash}`,
          {
            scroll: false,
          },
        );
      }
      await refresh();
      return true;
    } catch {
      toast.error(t("deleteError"));
      return false;
    }
  }

  return {
    create,
    update,
    setStatus,
    remove,
    submitting: createMutation.isPending || updateMutation.isPending,
    statusPending: statusMutation.isPending,
    deletePending: deleteMutation.isPending,
  };
}
