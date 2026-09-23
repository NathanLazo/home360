import { cn } from "~/lib/utils";

type GuaranteeMarqueeProps = {
  /** Accessible name of the list. */
  label: string;
  items: readonly { key: string; node: React.ReactNode }[];
};

/**
 * Endless rail of the guarantee options. The track holds two copies of the
 * list and slides by exactly one copy (`-50%`), so the loop has no seam; the
 * second copy is hidden from assistive tech. Hovering pauses it.
 *
 * Under reduced motion the rail stops, the duplicate disappears and the real
 * list wraps onto as many rows as it needs: every option stays visible.
 */
export function GuaranteeMarquee({ label, items }: GuaranteeMarqueeProps) {
  const listClass =
    "flex shrink-0 items-stretch gap-4 pr-4 motion-reduce:flex-wrap motion-reduce:pr-0";

  return (
    <div className="group/marquee relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:[mask-image:none]">
      <div className="flex w-max animate-[landing-marquee_48s_linear_infinite] py-3 group-hover/marquee:[animation-play-state:paused] motion-reduce:w-full motion-reduce:animate-none">
        <ul aria-label={label} className={listClass}>
          {items.map((item) => (
            <li key={item.key} className="flex">
              {item.node}
            </li>
          ))}
        </ul>
        <ul
          aria-hidden="true"
          className={cn(listClass, "motion-reduce:hidden")}
        >
          {items.map((item) => (
            <li key={item.key} className="flex">
              {item.node}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
