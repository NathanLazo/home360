"use client";

import { useEffect } from "react";
import { hasLocale, useLocale } from "next-intl";

import { getPathname } from "~/i18n/navigation";
import { splitLocaleFromPathname } from "~/i18n/locale-pathname";
import { routing } from "~/i18n/routing";
import { SESSION_ENDED_ERROR } from "~/lib/auth/session-errors";

const POLL_INTERVAL_MS = 15_000;

function hasSessionUser(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null && "user" in payload;
}

/**
 * Keeps an open screen honest about its session: every 15 s while the tab is
 * visible (and on focus) it asks the server, which re-verifies the `Session`
 * row. When the session was revoked — login on another computer, sign-out,
 * password change, suspension — it hard-navigates to the login page so no
 * client state outlives the session. Network errors and transient server
 * failures never log the user out. Renders nothing.
 */
export function SessionGuard() {
  const currentLocale = useLocale();
  const locale = hasLocale(routing.locales, currentLocale)
    ? currentLocale
    : routing.defaultLocale;

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    function endSession() {
      const { pathname } = splitLocaleFromPathname(window.location.pathname);
      window.location.replace(
        getPathname({
          href: {
            pathname: "/login",
            query: { error: SESSION_ENDED_ERROR, callbackUrl: pathname },
          },
          locale,
        }),
      );
    }

    async function checkSession() {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (!cancelled && !hasSessionUser(payload)) endSession();
      } catch {
        // Offline or aborted: try again on the next tick.
      } finally {
        inFlight = false;
      }
    }

    const interval = window.setInterval(
      () => void checkSession(),
      POLL_INTERVAL_MS,
    );
    const onVisible = () => void checkSession();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [locale]);

  return null;
}
