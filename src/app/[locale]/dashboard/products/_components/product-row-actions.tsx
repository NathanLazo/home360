"use client";

import { useState } from "react";
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import type { ProductListItem } from "./product.types";
import { ConfirmDialog } from "~/components/confirm-dialog";
import { useSubscriptionAccess } from "~/components/dashboard/subscription-access-context";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function ProductRowActions({
  product,
  busy,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  product: ProductListItem;
  busy: boolean;
  onEdit: (product: ProductListItem) => void;
  onStatusChange: (product: ProductListItem) => Promise<boolean>;
  onDelete: (product: ProductListItem) => Promise<boolean>;
}) {
  const t = useTranslations("dashboard.products");
  const readOnlyT = useTranslations("dashboard.subscription.readOnly");
  // The menu stays reachable so the reason is visible; only the mutating
  // entries are blocked.
  const { isReadOnly } = useSubscriptionAccess();
  const readOnlyTitle = isReadOnly ? readOnlyT("actionDisabled") : undefined;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const publishing = product.status === "DRAFT";

  async function handleDelete() {
    if (await onDelete(product)) setConfirmOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 sm:min-h-10 sm:min-w-10"
            aria-label={t("actions.open", { name: product.name })}
            disabled={busy}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => onEdit(product)}
            disabled={isReadOnly}
            title={readOnlyTitle}
          >
            <PencilIcon aria-hidden="true" />
            {t("actions.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void onStatusChange(product)}
            disabled={busy || isReadOnly}
            title={readOnlyTitle}
          >
            {publishing ? (
              <EyeIcon aria-hidden="true" />
            ) : (
              <EyeOffIcon aria-hidden="true" />
            )}
            {t(publishing ? "actions.publish" : "actions.unpublish")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
            disabled={isReadOnly}
            title={readOnlyTitle}
          >
            <Trash2Icon aria-hidden="true" />
            {t("actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("delete.title")}
        description={t("delete.description", { name: product.name })}
        confirmLabel={t("delete.confirm")}
        cancelLabel={t("delete.cancel")}
        destructive
        loading={busy}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
