"use client";

import { useState } from "react";
import { LoaderCircleIcon, LogOutIcon } from "lucide-react";
import { hasLocale, useLocale } from "next-intl";
import { signOut } from "next-auth/react";

import { DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { getPathname } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

export type SignOutItemProps = {
  label: string;
  pendingLabel: string;
};

export function SignOutItem({ label, pendingLabel }: SignOutItemProps) {
  const currentLocale = useLocale();
  const [pending, setPending] = useState(false);
  const locale = hasLocale(routing.locales, currentLocale)
    ? currentLocale
    : routing.defaultLocale;

  async function handleSignOut() {
    setPending(true);

    try {
      await signOut({
        redirectTo: getPathname({ href: "/login", locale }),
      });
    } catch {
      setPending(false);
    }
  }

  return (
    <DropdownMenuItem
      disabled={pending}
      onSelect={(event) => {
        event.preventDefault();
        void handleSignOut();
      }}
    >
      {pending ? (
        <LoaderCircleIcon aria-hidden="true" className="animate-spin" />
      ) : (
        <LogOutIcon aria-hidden="true" />
      )}
      {pending ? pendingLabel : label}
    </DropdownMenuItem>
  );
}
