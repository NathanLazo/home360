"use client";

import { skipToken } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { AdminOrderDetailBody } from "./admin-order-detail-body";
import { CopyIdButton } from "../../_components/copy-id-button";
import { DetailSheetSkeleton } from "../../_components/detail-sheet-skeleton";
import { SectionError } from "~/components/section-error";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

/** `admin.orders.getById` in a side sheet; the URL keeps `?order=`. */
export function AdminOrderDetailSheet({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("admin.orders.detail");
  // skipToken (not `enabled`) so a retry `refetch()` or an empty `?order=`
  // never sends a placeholder id to the server.
  const query = api.admin.orders.getById.useQuery(
    orderId ? { id: orderId } : skipToken,
  );
  const state = unwrapEnvelope(query);

  return (
    <Sheet
      open={Boolean(orderId)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto overscroll-contain sm:max-w-xl">
        <SheetHeader>
          <div className="flex min-w-0 flex-col gap-1.5 pr-8">
            <SheetTitle className="font-mono tabular-nums">
              {state.status === "success"
                ? t("titleWithFolio", { folio: state.data.folio })
                : t("title")}
            </SheetTitle>
            <SheetDescription>
              {state.status === "success" ? state.data.title : t("subtitle")}
            </SheetDescription>
          </div>
          {state.status === "success" ? (
            <CopyIdButton value={state.data.id} className="-ml-2 self-start" />
          ) : null}
        </SheetHeader>

        <div className="px-4 pb-6">
          {state.status === "pending" ? (
            <DetailSheetSkeleton label={t("loading")} />
          ) : null}

          {state.status === "error" ? (
            <SectionError
              title={t("errorTitle")}
              code={state.code}
              onRetry={() => void query.refetch()}
            />
          ) : null}

          {state.status === "success" ? (
            <AdminOrderDetailBody detail={state.data} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
