/**
 * Hairline grid behind the hero, drawn from `--border` and faded out with a
 * radial mask so it frames the headline without competing with it. Pure
 * decoration: static, hidden from assistive tech.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_30%,transparent_100%)] bg-[size:56px_56px] bg-[position:center_top]"
    />
  );
}
