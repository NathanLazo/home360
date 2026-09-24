"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Wires next-themes to the `.dark` class that `globals.css` reads
 * (`@custom-variant dark (&:is(.dark *))`). Light by default so the landing
 * and auth screens keep their designed look; the footer toggle flips it and
 * the choice persists in localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
