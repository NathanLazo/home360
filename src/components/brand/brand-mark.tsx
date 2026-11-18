import Image from "next/image";

import { cn } from "~/lib/utils";

export const BRAND_MARK_SRC = "/brand/home360-mark.svg";

type BrandMarkProps = {
  /** Rendered square size in px. */
  size: number;
  className?: string;
  /**
   * Accessible name when the mark stands alone; omit it when the "HOME360"
   * wordmark sits next to it (then the mark is decorative).
   */
  label?: string;
};

/**
 * Official HOME360 mark: liquid-metal double ring with the roof chevron.
 * Served as a static SVG (gradients stay scoped to the file, so any number
 * of marks can share a page) and never re-encoded by the image optimizer.
 */
export function BrandMark({ size, className, label }: BrandMarkProps) {
  return (
    <Image
      src={BRAND_MARK_SRC}
      width={size}
      height={size}
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      unoptimized
      priority
      className={cn("shrink-0 select-none", className)}
    />
  );
}
