"use client";

import { useEffect, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

import {
  DashboardSidebar,
  type DashboardSidebarProps,
} from "~/components/dashboard-sidebar";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { usePathname } from "~/i18n/navigation";

type DashboardMobileNavProps = DashboardSidebarProps & {
  openLabel: string;
  closeLabel: string;
  title: string;
  description: string;
};

export function DashboardMobileNav({
  openLabel,
  closeLabel,
  title,
  description,
  ...sidebarProps
}: DashboardMobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    setOpen(false);
  }, [routeKey]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label={openLabel}
          className="mr-auto lg:hidden"
        >
          <MenuIcon aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-72 gap-0 p-0 sm:max-w-72"
      >
        <SheetHeader className="min-h-16 flex-row items-center justify-between gap-3 border-b px-4 py-2">
          <div className="min-w-0">
            <SheetTitle className="truncate">{title}</SheetTitle>
            <SheetDescription className="sr-only">
              {description}
            </SheetDescription>
          </div>
          <SheetClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={closeLabel}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </SheetHeader>
        <DashboardSidebar
          {...sidebarProps}
          className="h-auto min-h-0 w-full flex-1 border-r-0"
        />
      </SheetContent>
    </Sheet>
  );
}
