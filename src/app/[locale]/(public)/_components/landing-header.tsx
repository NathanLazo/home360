"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { LANDING_ANCHORS, LANDING_NAV_KEYS } from "./landing-data";
import { focusRingClass, pressClass } from "./landing-styles";
import { ScrollProgress } from "./scroll-progress";
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

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur-md transition-[background-color,border-color] duration-200",
        isScrolled
          ? "border-border bg-background/80"
          : "bg-background/0 border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className={cn(
            "flex min-h-11 items-center gap-2.5 rounded-md",
            focusRingClass,
          )}
        >
          <span
            aria-hidden="true"
            className="bg-foreground text-background flex size-8 items-center justify-center rounded-md text-base font-semibold"
          >
            {t("logoMark")}
          </span>
          <span className="text-base font-semibold tracking-[-0.02em]">
            {t("brand")}
          </span>
        </Link>

        <nav
          aria-label={t("navLabel")}
          className="hidden items-center gap-1 lg:flex"
        >
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={cn(
                "text-muted-foreground hover:bg-foreground/5 hover:text-foreground rounded-full px-3 py-2 text-sm",
                pressClass,
                focusRingClass,
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-1 lg:flex">
          <Link
            href="/login"
            className={cn(
              "hover:bg-foreground/5 inline-flex h-9 items-center rounded-full px-4 text-sm font-medium",
              pressClass,
              focusRingClass,
            )}
          >
            {t("login")}
          </Link>
          <Link
            href="/register"
            className={cn(
              "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-full px-4 text-sm font-medium",
              pressClass,
              focusRingClass,
            )}
          >
            {t("cta")}
          </Link>
        </div>

        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                "hover:bg-foreground/5 inline-flex size-11 items-center justify-center rounded-full lg:hidden",
                pressClass,
                focusRingClass,
              )}
            >
              <MenuIcon aria-hidden="true" className="size-5" />
              <span className="sr-only">{t("menuLabel")}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t("menuTitle")}</SheetTitle>
              <SheetDescription>{t("menuDescription")}</SheetDescription>
            </SheetHeader>
            <nav
              aria-label={t("navLabel")}
              className="flex flex-col gap-1 px-4 pb-4"
            >
              {navItems.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={closeMenu}
                  className={cn(
                    "hover:bg-foreground/5 rounded-md px-2 py-3 text-base font-medium",
                    focusRingClass,
                  )}
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className={cn(
                    "hover:bg-foreground/5 inline-flex h-11 items-center justify-center rounded-full border text-base font-medium",
                    pressClass,
                    focusRingClass,
                  )}
                >
                  {t("login")}
                </Link>
                <Link
                  href="/register"
                  onClick={closeMenu}
                  className={cn(
                    "bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-full text-base font-medium",
                    pressClass,
                    focusRingClass,
                  )}
                >
                  {t("cta")}
                </Link>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
      <ScrollProgress />
    </header>
  );
}
