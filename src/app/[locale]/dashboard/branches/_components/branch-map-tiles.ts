const SUBDOMAINS = ["a", "b", "c", "d"] as const;

export type MapTileTheme = "light" | "dark";

/**
 * CARTO basemaps (OSM data): neutral greys that sit on the ink/zinc system
 * without competing with the coverage overlay. Retina tiles on dpr ≥ 2.
 */
export function cartoTiles(theme: MapTileTheme) {
  const style = theme === "dark" ? "dark_all" : "light_all";
  return (x: number, y: number, z: number, dpr?: number) => {
    const subdomain = SUBDOMAINS[(x + y) % SUBDOMAINS.length] ?? "a";
    const retina = dpr !== undefined && dpr >= 2 ? "@2x" : "";
    return `https://${subdomain}.basemaps.cartocdn.com/${style}/${z}/${x}/${y}${retina}.png`;
  };
}
