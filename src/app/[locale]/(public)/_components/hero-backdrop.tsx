/**
 * The hero's atmosphere: the action tint as a mesh (`bg-mesh-hero`, sky /
 * lime stops) at hero scale, the page's only mesh (DESIGN.md §2). It fades
 * into `canvas-soft` toward the bottom so the console and the next section
 * sit on plain canvas. Static decoration, hidden from assistive tech; never
 * miniaturised onto chips, buttons or text.
 */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="bg-mesh-hero pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
    />
  );
}
