"use client";

import { MenuIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { LANDING_ANCHORS, LANDING_NAV_KEYS } from "./landing-data";
import { focusRingClass, pressClass } from "./landing-styles";
import { useHeroCtaInView } from "./use-hero-cta-in-view";
import { GlassDock } from "~/components/glass";
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

/**
 * The landing's signature: a floating Liquid Glass dock carrying the nav and
 * the liquid-metal "register" action (the one glass + metal pairing of the
 * page, DESIGN.md §6).
 *
 * Metal budget rule (≤ 2 live per screen): the hero already shows a live
 * `bend` CTA and the live "new" badge. While the hero CTA is on screen the
 * nav action wears the static chrome rim; once it scrolls out, the nav action
 * turns live. An IntersectionObserver decides (`useHeroCtaInView`), never a
 * scroll listener. Reduced motion, no WebGL2 and the first paint keep the
 * static rim regardless.
 *
 * Desktop (≥ lg): one 64 px line with brand, section links, sign in, register.
 * Below lg the links collapse into a sheet; register stays in the dock from
 * `sm` up and always in the sheet.
 */
export function LandingHeader() {
  const t = useTranslations("landing.header");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const heroCtaInView = useHeroCtaInView();

  const navItems = LANDING_NAV_KEYS.map((key) => ({
    key,
    href: `#${LANDING_ANCHORS[key]}`,
    label: t(`nav.${key}`),
  }));

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 px-4 sm:px-6 lg:px-8">
      <GlassDock
        className="pointer-events-auto mx-auto h-16 w-full max-w-6xl gap-4 p-3 pl-5"
        action={
          <div className="flex items-center gap-1">
            <span className="hidden sm:flex">
              <Button
                asChild
                size="pill-sm"
                metal="live"
                metalActive={!heroCtaInView}
              >
                <Link href="/register">{t("cta")}</Link>
              </Button>
            </span>
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen} mobile="side">
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full lg:hidden"
                >
                  <MenuIcon aria-hidden="true" className="size-5" />
                  <span className="sr-only">{t("menuLabel")}</span>
                </Button>
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
                        "text-copy hover:bg-accent rounded-sm px-2 py-3 font-medium",
                        focusRingClass,
                      )}
                    >
                      {item.label}
                    </a>
                  ))}
                  <div className="mt-4 flex flex-col gap-2">
                    <Button asChild variant="secondary" size="pill">
                      <Link href="/login" onClick={closeMenu}>
                        {t("login")}
                      </Link>
                    </Button>
                    <Button asChild size="pill">
                      <Link href="/register" onClick={closeMenu}>
                        {t("cta")}
                      </Link>
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        }
      >
        <Link
          href="/"
          className={cn(
            "flex min-h-10 shrink-0 items-center gap-2.5 rounded-sm",
            focusRingClass,
          )}
        >
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-sm text-sm font-semibold"
          >
            {t("logoMark")}
          </span>
          <span className="text-copy font-semibold tracking-[-0.02em]">
            {t("brand")}
          </span>
        </Link>

        <nav
          aria-label={t("navLabel")}
          className="hidden flex-1 items-center justify-center gap-0.5 lg:flex"
        >
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={cn(
                "text-copy-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground rounded-pill px-3 py-2 whitespace-nowrap",
                pressClass,
                focusRingClass,
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          href="/login"
          className={cn(
            "text-copy-sm hover:bg-foreground/5 rounded-pill hidden h-10 shrink-0 items-center px-4 font-medium whitespace-nowrap lg:inline-flex",
            pressClass,
            focusRingClass,
          )}
        >
          {t("login")}
        </Link>
      </GlassDock>
    </header>
  );
}
