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

export function LocaleSwitcher() {
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
          variant="outline"
          size="icon-lg"
          aria-label={t("label")}
        >
          <LanguagesIcon aria-hidden="true" />
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
