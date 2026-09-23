import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type scale in `globals.css` (`--text-display-*`, `--text-copy*`,
 * `--text-label`) is unknown to tailwind-merge, which would otherwise read
 * `text-copy-sm` as a text color and drop a sibling `text-muted-foreground`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-hero",
            "display-xl",
            "display-lg",
            "display-md",
            "display-sm",
            "copy",
            "copy-sm",
            "label",
          ],
        },
      ],
      rounded: [{ rounded: ["pill"] }],
      shadow: [
        {
          shadow: ["hairline", "subtle", "soft", "float", "modal", "metal"],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
