import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { MetalAction } from "~/components/metal";
import { cn } from "~/lib/utils";

/**
 * Buttons (DESIGN.md §5).
 *
 * `default` is the liquid-metal primary: an ink core wearing a static CSS
 * chrome rim (`metal-rim` in `globals.css`) — cheap, SSR-safe, no WebGL.
 * The decisive action of a screen (≤ 1–2 per screen) can upgrade to the live
 * WebGL ring with `metal="live"` (or `metal="bend"` for the single key CTA).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Liquid-metal primary: ink core + static chrome rim. */
        default:
          "metal-rim text-primary-foreground shadow-metal hover:[--metal-core:color-mix(in_oklch,var(--primary)_86%,white)] dark:hover:[--metal-core:color-mix(in_oklch,var(--primary)_88%,black)]",
        destructive:
          "bg-destructive text-white hover:bg-error-deep focus-visible:ring-destructive dark:text-on-ink dark:hover:bg-destructive/90",
        /** Transparent with a stronger hairline; sits on any surface. */
        outline:
          "border border-hairline-strong bg-transparent hover:bg-accent hover:text-accent-foreground dark:border-input dark:hover:bg-input/30",
        /** White canvas + hairline: the default companion to the primary. */
        secondary:
          "border bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        /** `link-deep` keeps AA on canvas-soft (plain #0070f3 is 4.36:1 there). */
        link: "text-link-deep underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-xs px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 px-6 text-base has-[>svg]:px-4",
        icon: "size-10",
        "icon-xs": "size-6 rounded-xs [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-12",
        /** Marketing CTA (landing): 48 px pill. */
        pill: "h-12 rounded-pill px-6 text-[0.9375rem] has-[>svg]:px-5",
        /** Compact marketing pill (nav bars, glass docks): 40 px. */
        "pill-sm": "h-10 rounded-pill px-5 has-[>svg]:px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonMetal =
  /** Static chrome rim only (the default for `variant="default"`). */
  | "static"
  /** Live WebGL silver ring around the button (`MetalAction`). */
  | "live"
  /** Live ring + liquid dent under the cursor: the single key CTA only. */
  | "bend";

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Upgrade the metal primary to the live ring. Only honored on
     * `variant="default"`. Budget: ≤ 1–2 live actions per screen. Falls back
     * to the static rim on the server's first paint, without WebGL2 and under
     * reduced motion; a disabled button never wears the live ring.
     */
    metal?: ButtonMetal;
    /** Layout classes for the live ring wrapper (e.g. `w-full`, `flex-1`). */
    metalClassName?: string;
    /**
     * Dim a live ring without unmounting it (e.g. hand the live budget to
     * another action on screen). Unlike switching `metal` to `"static"`,
     * this never remounts the button, so keyboard focus survives.
     */
    metalActive?: boolean;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  metal = "static",
  metalClassName,
  metalActive = true,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  const button = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );

  if (variant !== "default" || metal === "static") {
    return button;
  }

  return (
    <MetalAction
      active={metalActive && !props.disabled}
      bend={metal === "bend"}
      className={metalClassName}
    >
      {button}
    </MetalAction>
  );
}

export { Button, buttonVariants, type ButtonMetal, type ButtonProps };
