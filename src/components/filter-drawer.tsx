"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { useIsMobileViewport } from "~/hooks/use-media-query";
import { cn } from "~/lib/utils";

/**
 * Phone home for a filter row: a pill button with the applied count that
 * opens a bottom drawer holding the controls. Filters apply as they change
 * (the list behind the drawer updates live), so the footer only closes or
 * clears. Renders nothing above `sm`; the caller shows the controls inline.
 */
export function FilterDrawer({
  children,
  activeCount = 0,
  onClear,
  triggerLabel,
  triggerIcon,
  triggerClassName,
}: {
  children: ReactNode;
  activeCount?: number;
  onClear?: () => void;
  triggerLabel: string;
  triggerIcon?: ReactNode;
  triggerClassName?: string;
}) {
  const t = useTranslations("common.filters");
  const isMobile = useIsMobileViewport();
  const [open, setOpen] = useState(false);
  const active = activeCount > 0;

  return (
    <Drawer open={open && isMobile} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "outline"}
          className={cn("shrink-0", triggerClassName)}
          aria-label={
            active ? t("openWithCount", { count: activeCount }) : triggerLabel
          }
        >
          {triggerIcon}
          {triggerLabel}
          {active ? (
            <span
              aria-hidden="true"
              className="bg-ink text-on-ink inline-flex min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[0.6875rem] leading-5 tabular-nums"
            >
              {activeCount}
            </span>
          ) : null}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="px-5">
          <DrawerTitle>{t("title")}</DrawerTitle>
          <DrawerDescription>{t("description")}</DrawerDescription>
        </DrawerHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-5 pb-2 [&_[data-slot=select-trigger]]:w-full">
          {children}
        </div>
        <DrawerFooter className="grid grid-cols-2 px-5">
          {onClear ? (
            <Button
              type="button"
              variant="outline"
              disabled={!active}
              onClick={onClear}
            >
              {t("clear")}
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          <DrawerClose asChild>
            <Button type="button">{t("done")}</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
