"use client";

import type { ReactNode } from "react";

import { TabsList, TabsTrigger } from "~/components/ui/tabs";

export type AnimatedTabItem<TValue extends string> = {
  value: TValue;
  label: ReactNode;
};

export type AnimatedTabsListProps<TValue extends string> = {
  items: ReadonlyArray<AnimatedTabItem<TValue>>;
  /** Kept for call-site symmetry; the active value comes from `Tabs`. */
  value: TValue;
  className?: string;
};

/**
 * Admin tab strip whose active pill slides between triggers instead of
 * blinking in place: it tells the eye where the selection went. Built on the
 * shared `animatedIndicator` pill (250 ms smooth-out), which jumps without
 * motion on keyboard changes and under `prefers-reduced-motion`.
 */
export function AnimatedTabsList<TValue extends string>({
  items,
  className,
}: AnimatedTabsListProps<TValue>) {
  return (
    <TabsList animatedIndicator className={className}>
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value}>
          <span className="tabular-nums">{item.label}</span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
