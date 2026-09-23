"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { accessActionFor } from "./customer-row-actions";
import type { UserAccessAction } from "./user-access-dialogs";
import type { UserAccessStatus } from "./users.schema";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export function WorkerRowActions({
  accessStatus,
  onViewBusiness,
  onAccessAction,
}: {
  /** Null while the worker never claimed an app account. */
  accessStatus: UserAccessStatus | null;
  onViewBusiness: () => void;
  onAccessAction: (action: UserAccessAction) => void;
}) {
  const t = useTranslations("admin.users.actions");
  const action = accessStatus ? accessActionFor(accessStatus) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("open")}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            onViewBusiness();
          }}
        >
          {t("viewBusiness")}
        </DropdownMenuItem>
        {action ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant={action === "suspend" ? "destructive" : "default"}
              onSelect={(event) => {
                event.preventDefault();
                onAccessAction(action);
              }}
            >
              {t(action === "suspend" ? "suspendAccount" : "reactivateAccount")}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled>{t("noAppAccount")}</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
