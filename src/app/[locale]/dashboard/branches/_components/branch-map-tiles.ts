export type MapTileTheme = "light" | "dark";

const CANVAS_STYLE: Record<MapTileTheme, string> = {
  light: "World_Light_Gray_Base",
  dark: "World_Dark_Gray_Base",
};

/**
 * Esri Canvas basemaps: keyless, neutral greys that sit on the ink/zinc
 * system without competing with the coverage overlay. (CARTO's public
 * basemaps now require an API key and serve watermark tiles without one.)
 */
export function basemapTiles(theme: MapTileTheme) {
  const style = CANVAS_STYLE[theme];
  return (x: number, y: number, z: number) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${style}/MapServer/tile/${z}/${y}/${x}`;
}
