"use client";

import { useTranslations } from "next-intl";

import { CopyIdButton } from "../../_components/copy-id-button";
import { DetailSheetSkeleton } from "../../_components/detail-sheet-skeleton";
import { CustomerDetailBody } from "./customer-detail-body";
import { accessActionFor } from "./customer-row-actions";
import type { UserAccessAction } from "./user-access-dialogs";
import { SectionError } from "~/components/section-error";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { UserAvatar } from "~/components/user-avatar";
import { unwrapEnvelope } from "~/lib/trpc-envelope";
import { api } from "~/trpc/react";

export type CustomerDetailSheetProps = {
  customerId: string | null;
  onClose: () => void;
  onAccessAction: (userId: string, action: UserAccessAction) => void;
};

export function CustomerDetailSheet({
  customerId,
  onClose,
  onAccessAction,
}: CustomerDetailSheetProps) {
  const t = useTranslations("admin.users.customerDetail");
  const actionsT = useTranslations("admin.users.actions");
  const usersT = useTranslations("admin.users");
  const query = api.admin.users.getCustomerDetail.useQuery(
    { userId: customerId ?? "" },
    { enabled: customerId !== null },
  );
  const state = unwrapEnvelope(query);
  const action =
    state.status === "success"
      ? accessActionFor(state.data.accessStatus)
      : null;

  return (
    <Sheet
      open={customerId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center gap-3 pr-8">
            {state.status === "success" ? (
              <UserAvatar
                seed={state.data.id}
                name={state.data.name ?? usersT("unnamed")}
                size={48}
                state={
                  state.data.accessStatus === "suspended"
                    ? "sleeping"
                    : "default"
                }
                interactive
              />
            ) : null}
            <div className="flex min-w-0 flex-col gap-1.5">
              <SheetTitle>
                {state.status === "success"
                  ? (state.data.name ?? usersT("unnamed"))
                  : t("title")}
              </SheetTitle>
              <SheetDescription>{t("subtitle")}</SheetDescription>
            </div>
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
            <CustomerDetailBody detail={state.data} />
          ) : null}
        </div>

        {state.status === "success" && action ? (
          <SheetFooter className="border-t">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={action === "suspend" ? "outline" : "default"}
                onClick={() => onAccessAction(state.data.id, action)}
              >
                {actionsT(
                  action === "suspend" ? "suspendAccount" : "reactivateAccount",
                )}
              </Button>
            </div>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
