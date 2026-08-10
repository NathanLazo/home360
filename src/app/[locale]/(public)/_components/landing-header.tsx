"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { LANDING_ANCHORS, LANDING_NAV_KEYS } from "./landing-data";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";

const SCROLL_THRESHOLD_PX = 8;

const focusRing =
  "focus-visible:ring-[var(--brand-gold)] rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-cream)] focus-visible:outline-none";

export function LandingHeader() {
  const t = useTranslations("landing.header");
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD_PX);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const navItems = LANDING_NAV_KEYS.map((key) => ({
    key,
    href: `#${LANDING_ANCHORS[key]}`,
    label: t(`nav.${key}`),
  }));

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-[color-mix(in_srgb,var(--brand-cream)_88%,transparent)] backdrop-blur",
        isScrolled
          ? "border-b border-[color-mix(in_srgb,var(--brand-gold)_45%,transparent)] shadow-[0_8px_24px_-16px_var(--brand-navy)]"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className={cn(
            "flex min-h-11 items-center gap-2 text-[var(--brand-navy)]",
            focusRing,
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand-navy)] text-lg font-semibold text-[var(--brand-gold)]"
          >
            {t("logoMark")}
          </span>
          <span className="text-lg font-semibold tracking-tight underline decoration-[var(--brand-gold)] decoration-2 underline-offset-4">
            {t("brand")}
          </span>
        </Link>

        <nav
          aria-label={t("navLabel")}
          className="hidden items-center gap-6 lg:flex"
        >
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={cn(
                "text-sm font-medium text-[var(--brand-navy)] underline-offset-8 hover:underline hover:decoration-[var(--brand-gold)] hover:decoration-2",
                focusRing,
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button
            asChild
            variant="ghost"
            className={cn(
              "text-[var(--brand-navy)] hover:bg-[color-mix(in_srgb,var(--brand-navy)_8%,transparent)] hover:text-[var(--brand-navy)]",
              focusRing,
            )}
          >
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Button
            asChild
            className={cn(
              "bg-[var(--brand-navy)] text-[var(--brand-gold)] hover:bg-[color-mix(in_srgb,var(--brand-navy)_88%,white)]",
              focusRing,
            )}
          >
            <Link href="/register">{t("cta")}</Link>
          </Button>
        </div>

        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "size-11 text-[var(--brand-navy)] lg:hidden",
                "hover:bg-[color-mix(in_srgb,var(--brand-navy)_8%,transparent)]",
                focusRing,
              )}
            >
              <MenuIcon aria-hidden="true" />
              <span className="sr-only">{t("menuLabel")}</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="bg-[var(--brand-cream)] text-[var(--brand-navy)]"
          >
            <SheetHeader>
              <SheetTitle className="text-[var(--brand-navy)]">
                {t("menuTitle")}
              </SheetTitle>
              <SheetDescription className="text-[color-mix(in_srgb,var(--brand-navy)_65%,transparent)]">
                {t("menuDescription")}
              </SheetDescription>
            </SheetHeader>
            <nav
              aria-label={t("navLabel")}
              className="flex flex-col gap-1 px-4 pb-4"
            >
              {navItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={() => {
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "rounded-md px-2 py-3 text-base font-medium text-[var(--brand-navy)] hover:bg-[color-mix(in_srgb,var(--brand-navy)_8%,transparent)]",
                    focusRing,
                  )}
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  asChild
                  variant="outline"
                  className={cn(
                    "border-[var(--brand-navy)] text-[var(--brand-navy)] hover:bg-[color-mix(in_srgb,var(--brand-navy)_8%,transparent)] hover:text-[var(--brand-navy)]",
                    focusRing,
                  )}
                >
                  <Link
                    href="/login"
                    onClick={() => {
                      setIsMenuOpen(false);
                    }}
                  >
                    {t("login")}
                  </Link>
                </Button>
                <Button
                  asChild
                  className={cn(
                    "bg-[var(--brand-navy)] text-[var(--brand-gold)] hover:bg-[color-mix(in_srgb,var(--brand-navy)_88%,white)]",
                    focusRing,
                  )}
                >
                  <Link
                    href="/register"
                    onClick={() => {
                      setIsMenuOpen(false);
                    }}
                  >
                    {t("cta")}
                  </Link>
                </Button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
