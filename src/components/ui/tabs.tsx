"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "~/lib/utils";

type TabsIndicatorState = {
  activeValue: string | undefined;
  layoutId: string;
  /** True when the last change came from the keyboard: the pill jumps. */
  instant: boolean;
};

const TabsIndicatorContext = React.createContext<TabsIndicatorState | null>(
  null,
);
type TabsListState = {
  variant: "default" | "line";
  animatedIndicator: boolean;
};

const TabsListContext = React.createContext<TabsListState>({
  variant: "default",
  animatedIndicator: false,
});

// transitions.dev tabs sliding: 250 ms, smooth-out, symmetric both ways.
const INDICATOR_TRANSITION = {
  duration: 0.25,
  ease: [0.22, 1, 0.36, 1],
} as const;
const INSTANT_TRANSITION = { duration: 0 } as const;

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  onKeyDownCapture,
  onPointerDownCapture,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const layoutId = React.useId();
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const [instant, setInstant] = React.useState(false);
  const lastInputRef = React.useRef<"pointer" | "keyboard">("pointer");
  const activeValue = value ?? uncontrolledValue;
  const indicator = React.useMemo(
    () => ({ activeValue, layoutId, instant }),
    [activeValue, layoutId, instant],
  );

  return (
    <TabsIndicatorContext.Provider value={indicator}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        orientation={orientation}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(nextValue) => {
          // Keyboard-driven changes never animate: arrow-key navigation is
          // repeated and must feel instant.
          setInstant(lastInputRef.current === "keyboard");
          setUncontrolledValue(nextValue);
          onValueChange?.(nextValue);
        }}
        onKeyDownCapture={(event) => {
          lastInputRef.current = "keyboard";
          onKeyDownCapture?.(event);
        }}
        onPointerDownCapture={(event) => {
          lastInputRef.current = "pointer";
          onPointerDownCapture?.(event);
        }}
        className={cn(
          "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
          className,
        )}
        {...props}
      />
    </TabsIndicatorContext.Provider>
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  animatedIndicator = false,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants> & {
    /**
     * Opt-in: the active pill (default variant) slides between triggers with
     * a 250 ms smooth-out layout animation. Pointer only; keyboard changes and
     * reduced motion snap instantly.
     */
    animatedIndicator?: boolean;
  }) {
  const listState = React.useMemo(
    () => ({ variant: variant ?? "default", animatedIndicator }),
    [variant, animatedIndicator],
  );

  return (
    <TabsListContext.Provider value={listState}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      />
    </TabsListContext.Provider>
  );
}

const triggerBaseClasses =
  "text-foreground/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:text-muted-foreground dark:hover:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity] duration-150 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";
const triggerStaticActiveClasses = [
  "group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none",
  "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
  "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
];
const triggerLineClasses =
  "after:bg-foreground after:absolute after:opacity-0 after:transition-opacity after:duration-150 group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100";

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const indicator = React.useContext(TabsIndicatorContext);
  const { variant, animatedIndicator } = React.useContext(TabsListContext);
  const reduceMotion = useReducedMotion();
  const animated = animatedIndicator && variant === "default";
  const showPill =
    animated && indicator !== null && indicator.activeValue === value;

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        triggerBaseClasses,
        animated
          ? "data-[state=active]:text-foreground dark:data-[state=active]:text-foreground"
          : triggerStaticActiveClasses,
        triggerLineClasses,
        className,
      )}
      {...props}
    >
      {animated ? (
        <>
          {showPill ? (
            <motion.span
              aria-hidden="true"
              layoutId={indicator.layoutId}
              transition={
                reduceMotion === true || indicator.instant
                  ? INSTANT_TRANSITION
                  : INDICATOR_TRANSITION
              }
              className="bg-background dark:border-input dark:bg-input/30 absolute -inset-px rounded-md border border-transparent shadow-sm"
            />
          ) : null}
          <span className="relative inline-flex items-center gap-1.5">
            {children}
          </span>
        </>
      ) : (
        children
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
