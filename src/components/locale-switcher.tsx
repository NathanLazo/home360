"use client";

import { LanguagesIcon } from "lucide-react";
import { hasLocale, useLocale, useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { usePathname, useRouter } from "~/i18n/navigation";
import { routing } from "~/i18n/routing";

type LocaleSwitcherProps = {
  tone?: "light" | "dark";
};

export function LocaleSwitcher({ tone = "light" }: LocaleSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common.localeSwitcher");

  function changeLocale(nextLocale: string) {
    if (hasLocale(routing.locales, nextLocale)) {
      router.replace(pathname, { locale: nextLocale });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("label")}
          className={
            tone === "dark"
              ? "border-0 bg-transparent text-white shadow-none hover:bg-transparent hover:text-white hover:opacity-80 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-white/60"
              : "border-0 bg-transparent shadow-none hover:bg-transparent hover:opacity-80 focus-visible:border-transparent focus-visible:ring-2"
          }
        >
          <LanguagesIcon className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
            <DropdownMenuRadioItem value="es">
              {t("spanish")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="en">
              {t("english")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
