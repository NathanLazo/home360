"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  CorporateLocationCreateInput,
  CorporateLocationUpdateInput,
} from "~/server/api/schemas/corporate";
import { api } from "~/trpc/react";

/**
 * Location mutations with envelope-aware feedback: errors resolve by stable
 * code (`PLAN_LIMIT_REACHED`, `CONFLICT`, …) into translated copy, never by
 * showing the raw `message`.
 */
export function useLocationMutations() {
  const t = useTranslations("corporate.locations.feedback");
  const errors = useTranslations("errors");
  const utils = api.useUtils();

  async function refresh() {
    await Promise.all([
      utils.corporate.listLocations.invalidate(),
      utils.corporate.getOverview.invalidate(),
      utils.corporate.getMembership.invalidate(),
      utils.corporate.listOrders.invalidate(),
    ]);
  }

  function failed(response: { error: string | null }) {
    if (!response.error) return false;
    toast.error(
      response.error === "PLAN_LIMIT_REACHED"
        ? t("planLimit")
        : errors(response.error),
    );
    return true;
  }

  const createMutation = api.corporate.createLocation.useMutation();
  const updateMutation = api.corporate.updateLocation.useMutation();
  const deactivateMutation = api.corporate.deactivateLocation.useMutation();

  async function create(input: CorporateLocationCreateInput) {
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

  async function update(input: CorporateLocationUpdateInput) {
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

  async function deactivate(locationId: string) {
    try {
      const response = await deactivateMutation.mutateAsync({ locationId });
      if (response.error === "CONFLICT") {
        toast.error(t("deactivateConflict"));
        return false;
      }
      if (failed(response) || !response.result) return false;
      toast.success(t("deactivated"));
      await refresh();
      return true;
    } catch {
      toast.error(t("deactivateError"));
      return false;
    }
  }

  return {
    create,
    update,
    deactivate,
    submitting: createMutation.isPending || updateMutation.isPending,
    deactivating: deactivateMutation.isPending,
  };
}
