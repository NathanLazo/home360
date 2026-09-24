"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useTranslations } from "next-intl";
import { Drawer as DrawerPrimitive } from "vaul";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { DrawerHandle } from "~/components/ui/drawer";
import { useIsMobileViewport } from "~/hooks/use-media-query";

type DialogMode = "modal" | "drawer";

const DialogModeContext = React.createContext<DialogMode>("modal");

/**
 * Centered modal on `sm+`; a draggable bottom sheet (vaul) on phones, where a
 * thumb reaches the actions and a flick dismisses. Both share one API, so a
 * screen never has to know which face is showing.
 */
function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const drawer = useIsMobileViewport();

  if (drawer) {
    return (
      <DialogModeContext value="drawer">
        <DrawerPrimitive.Root data-slot="dialog" autoFocus {...props} />
      </DialogModeContext>
    );
  }

  return (
    <DialogModeContext value="modal">
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </DialogModeContext>
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 bg-ink/40 fixed inset-0 z-50 duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:duration-150 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  const t = useTranslations("common");
  const mode = React.useContext(DialogModeContext);

  const closeButton = showCloseButton ? (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      className="ring-offset-background focus-visible:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity duration-150 after:absolute after:-inset-2.5 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
    >
      <XIcon />
      <span className="sr-only">{t("close")}</span>
    </DialogPrimitive.Close>
  ) : null;

  if (mode === "drawer") {
    // A content that opts out of the modal padding (`p-0`) lays out its own
    // header/body/footer, so the drawer body only reserves the safe area.
    const unpadded = /(^|\s)p-0(\s|$)/.test(className ?? "");

    return (
      <DrawerPrimitive.Portal data-slot="dialog-portal">
        <DrawerPrimitive.Overlay
          data-slot="dialog-overlay"
          className="bg-ink/40 fixed inset-0 z-50"
        />
        <DrawerPrimitive.Content
          data-slot="dialog-content"
          data-mode="drawer"
          className={cn(
            "bg-card text-card-foreground shadow-modal fixed inset-x-0 bottom-0 z-50 flex max-h-[94dvh] flex-col rounded-t-3xl outline-none",
            className,
          )}
          {...props}
        >
          <DrawerHandle />
          <div
            data-slot="dialog-body"
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
              unpadded
                ? "pb-[env(safe-area-inset-bottom)]"
                : "gap-4 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
            )}
          >
            {children}
          </div>
          {closeButton}
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    );
  }

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-mode="modal"
        className={cn(
          "bg-card text-card-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-96 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-96 shadow-modal fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl p-6 duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-[state=closed]:duration-150 motion-reduce:animate-none sm:max-w-lg",
          className,
        )}
        {...props}
      >
        {children}
        {closeButton}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  const t = useTranslations("common");

  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "grid auto-cols-fr grid-flow-col gap-2 *:w-full sm:flex sm:justify-end sm:*:w-auto [&_[data-slot=button]]:w-full sm:[&_[data-slot=button]]:w-auto",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">{t("close")}</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-display-sm text-balance", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-muted-foreground text-copy-sm text-pretty",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
