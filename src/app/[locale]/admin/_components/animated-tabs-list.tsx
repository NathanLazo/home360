"use client";

import type { ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import { ADMIN_DURATION, ADMIN_EASE_OUT } from "./admin-motion";
import { TabsList, TabsTrigger } from "~/components/ui/tabs";

export type AnimatedTabItem<TValue extends string> = {
  value: TValue;
  label: ReactNode;
};

export type AnimatedTabsListProps<TValue extends string> = {
  items: ReadonlyArray<AnimatedTabItem<TValue>>;
  value: TValue;
  className?: string;
};

/**
 * Admin tab strip whose active pill slides between triggers instead of
 * blinking in place: it tells the eye where the selection went. The pill is
 * the only moving piece (a transform-based layout animation, 200 ms ease-out)
 * and it snaps without motion under `prefers-reduced-motion`.
 */
export function AnimatedTabsList<TValue extends string>({
  items,
  value,
  className,
}: AnimatedTabsListProps<TValue>) {
  const groupId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <LayoutGroup id={groupId}>
      <TabsList className={className}>
        {items.map((item) => (
          <TabsTrigger
            key={item.value}
            value={item.value}
            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
          >
            {item.value === value ? (
              <motion.span
                layoutId="admin-tab-pill"
                aria-hidden="true"
                className="bg-background dark:border-input dark:bg-input/30 absolute -inset-px rounded-md border border-transparent shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: ADMIN_DURATION.standard,
                        ease: ADMIN_EASE_OUT,
                      }
                }
              />
            ) : null}
            <span className="relative tabular-nums">{item.label}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </LayoutGroup>
  );
}
