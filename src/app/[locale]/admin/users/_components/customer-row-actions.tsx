"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

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

/** The one access action each state may offer. */
export function accessActionFor(status: UserAccessStatus): UserAccessAction {
  return status === "active" ? "suspend" : "reactivate";
}

export function CustomerRowActions({
  accessStatus,
  onViewDetail,
  onAccessAction,
}: {
  accessStatus: UserAccessStatus;
  onViewDetail: () => void;
  onAccessAction: (action: UserAccessAction) => void;
}) {
  const t = useTranslations("admin.users.actions");
  const action = accessActionFor(accessStatus);

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
            onViewDetail();
          }}
        >
          {t("viewDetail")}
        </DropdownMenuItem>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
