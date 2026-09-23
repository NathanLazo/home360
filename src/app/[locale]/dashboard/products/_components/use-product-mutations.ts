"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type {
  ProductAdjustStockInput,
  ProductCreateInput,
  ProductUpdateInput,
} from "./product.schema";
import type { ProductListItem, ProductMutationResult } from "./product.types";
import { api } from "~/trpc/react";

type OperationResponse = {
  result: object | null;
  error: string | null;
};

export function useProductMutations() {
  const t = useTranslations("dashboard.products.feedback");
  const errors = useTranslations("errors");
  const utils = api.useUtils();
  const createMutation = api.product.create.useMutation();
  const updateMutation = api.product.update.useMutation();
  const statusMutation = api.product.setStatus.useMutation();
  const deleteMutation = api.product.delete.useMutation();
  const adjustStockMutation = api.product.adjustStock.useMutation();

  async function finish(
    response: OperationResponse,
    successMessage: string,
    conflictMessage?: string,
  ): Promise<ProductMutationResult> {
    if (response.error !== null || response.result === null) {
      const code = response.error;
      toast.error(
        code === "CONFLICT" && conflictMessage
          ? conflictMessage
          : code
            ? errors(code)
            : t("transportError"),
      );
      return { ok: false, error: code };
    }

    toast.success(successMessage);
    await Promise.all([
      utils.product.list.invalidate(),
      utils.product.listCategories.invalidate(),
      utils.product.getStockByBranch.invalidate(),
    ]);
    return { ok: true, error: null };
  }

  async function create(
    input: ProductCreateInput,
  ): Promise<ProductMutationResult> {
    try {
      return await finish(
        await createMutation.mutateAsync(input),
        t("created"),
      );
    } catch {
      toast.error(t("transportError"));
      return { ok: false, error: null };
    }
  }

  async function update(
    input: ProductUpdateInput,
    desiredStatus: ProductListItem["status"],
    currentStatus: ProductListItem["status"],
  ): Promise<ProductMutationResult> {
    try {
      const updated = await finish(
        await updateMutation.mutateAsync(input),
        t("updated"),
      );
      if (!updated.ok || desiredStatus === currentStatus) return updated;

      return await finish(
        await statusMutation.mutateAsync({
          id: input.id,
          status: desiredStatus,
        }),
        t(desiredStatus === "PUBLISHED" ? "published" : "unpublished"),
      );
    } catch {
      toast.error(t("transportError"));
      return { ok: false, error: null };
    }
  }

  async function setStatus(
    id: string,
    status: ProductListItem["status"],
  ): Promise<ProductMutationResult> {
    try {
      return await finish(
        await statusMutation.mutateAsync({ id, status }),
        t(status === "PUBLISHED" ? "published" : "unpublished"),
      );
    } catch {
      toast.error(t("transportError"));
      return { ok: false, error: null };
    }
  }

  async function adjustStock(
    input: ProductAdjustStockInput,
  ): Promise<ProductMutationResult> {
    try {
      return await finish(
        await adjustStockMutation.mutateAsync(input),
        t("stockAdjusted"),
      );
    } catch {
      toast.error(t("transportError"));
      return { ok: false, error: null };
    }
  }

  async function remove(id: string): Promise<ProductMutationResult> {
    try {
      return await finish(
        await deleteMutation.mutateAsync({ id }),
        t("deleted"),
        t("deleteConflict"),
      );
    } catch {
      toast.error(t("transportError"));
      return { ok: false, error: null };
    }
  }

  return {
    create,
    update,
    setStatus,
    adjustStock,
    remove,
    creating: createMutation.isPending,
    updating: updateMutation.isPending,
    changingStatus: statusMutation.isPending,
    deleting: deleteMutation.isPending,
    adjustingStock: adjustStockMutation.isPending,
  };
}
