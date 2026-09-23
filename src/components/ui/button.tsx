import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { MetalAction } from "~/components/metal";
import { cn } from "~/lib/utils";

/**
 * Buttons (DESIGN.md §6): slim pills (32 px default). On coarse pointers an
 * invisible `::after` extends the hit area to ≥ 44 px without growing the pill.
 *
 * `default` is the liquid-metal primary: an ink core wearing a static CSS
 * chrome rim (`metal-rim` in `globals.css`) — cheap, SSR-safe, no WebGL.
 * The decisive action of a screen (≤ 1–2 per screen) upgrades with
 * `metal="live"` (or `metal="bend"` for the single key CTA) to the landing
 * hero's button: ink pill + full-strength chromatic WebGL ring.
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-pill text-[0.8125rem] leading-none font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,scale] duration-150 ease-out active:scale-[0.97] motion-reduce:active:scale-100 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5 pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-2 pointer-coarse:after:content-['']",
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
        default: "h-8 px-3.5 has-[>svg]:px-3",
        xs: "h-6 gap-1 px-2.5 text-xs has-[>svg]:px-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-3 text-xs has-[>svg]:px-2.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 px-5 text-sm has-[>svg]:px-4",
        icon: "size-8 pointer-coarse:after:-inset-x-1.5",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-9",
        /** Marketing CTA (landing): 40 px pill. */
        pill: "h-10 px-5 text-sm has-[>svg]:px-4",
        /** Compact marketing pill (nav bars, glass docks): 32 px. */
        "pill-sm": "h-8 px-4 has-[>svg]:px-3.5",
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

  // A live ring renders the landing hero's metal button everywhere: a plain
  // ink pill (the static rim would double the edge and wash the shader out)
  // wearing the full-strength chromatic ring.
  const underLiveRing =
    variant === "default" &&
    metal !== "static" &&
    metalActive &&
    !props.disabled;

  const button = (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size }),
        underLiveRing &&
          "rounded-pill [--metal-gloss:none] [--metal-rim-width:0px]",
        className,
      )}
      {...props}
    />
  );

  if (variant !== "default" || metal === "static") {
    return button;
  }

  return (
    <MetalAction
      active={underLiveRing}
      bend={metal === "bend"}
      className={metalClassName}
    >
      {button}
    </MetalAction>
  );
}

export { Button, buttonVariants, type ButtonMetal, type ButtonProps };
