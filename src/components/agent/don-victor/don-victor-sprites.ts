import type { PaletteKey } from "./don-victor-palette";

/** Sprite canvas, in sprite pixels. Every layer is placed inside this box. */
export const SPRITE_SIZE = 40;

export type SpriteGrid = {
  width: number;
  height: number;
  rows: string[];
};

/** A grid placed at an offset inside the sprite box. */
export type SpriteLayer = {
  x: number;
  y: number;
  grid: SpriteGrid;
};

/**
 * Builds a grid from ASCII rows and checks they form a rectangle: an uneven
 * row would silently shift every pixel after it.
 */
export function grid(...rows: string[]): SpriteGrid {
  const width = rows[0]?.length ?? 0;

  for (const row of rows) {
    if (row.length !== width) {
      throw new Error(
        `Sprite row width mismatch: expected ${width}, got ${row.length} in "${row}"`,
      );
    }

    for (const char of row) {
      if (!isPaletteKey(char)) {
        throw new Error(`Unknown sprite colour "${char}" in "${row}"`);
      }
    }
  }

  return { width, height: rows.length, rows };
}

const PALETTE_KEYS = new Set<string>([
  ".",
  "K",
  "k",
  "S",
  "s",
  "W",
  "P",
  "M",
  "I",
  "i",
  "c",
  "L",
  "G",
  "g",
  "D",
  "B",
  "b",
]);

function isPaletteKey(char: string): char is PaletteKey {
  return PALETTE_KEYS.has(char);
}

/*
 * Bust of Don Víctor: hair with a side part, thick brows, moustache, warm
 * smile and the black HOME360 polo with the logo on the chest. Eyes are left
 * as skin here; the renderer paints them from `EYE` so pupils and blinks stay
 * data, not extra copies of the body.
 */
// prettier-ignore
export const BODY = grid(
  "........................................", // 0
  "........................................", // 1
  "........................................", // 2
  "..............KKKK......................", // 3 quiff
  ".............KKKKKKKKKKKK...............", // 4
  "............KKKKKKKKKKKKKKK.............", // 5
  "............KKKkkKKKKKKKKKKK............", // 6
  "...........KKKkkKKKKKKKKKKKKK...........", // 7
  "...........KKkkKKKKKKKKKKKKKK...........", // 8
  "...........KKkKKKKKKKKKKKKKKK...........", // 9
  "...........KKKKSSSSSSSSSSKKKK...........", // 10
  "...........KKSSSSSSSSSSSSSSKK...........", // 11
  "...........KSSSSSSSSSSSSSSSSK...........", // 12
  "...........KSSKKKSSSSSSKKKSSK...........", // 13 brows
  "..........SSSSSSSSSSSSSSSSSSSS..........", // 14 eyes row 1 + ears
  "..........SSSSSSSSSSSSSSSSSSSS..........", // 15 eyes row 2
  "..........sSSSSSSSSSsSSSSSSSSs..........", // 16
  "...........sSSSSSSSssSSSSSSSs...........", // 17 nose
  "............SSSKKKKKKKKKKSSS............", // 18 moustache
  "............SSKKKKKKKKKKKKSS............", // 19
  "............sSSSSMWWWWMSSSSs............", // 20 smile
  ".............sSSSSSSSSSSSSs.............", // 21
  "..............ssSSSSSSSSss..............", // 22 chin
  "................sSSSSSSs................", // 23 neck
  "................SSSSSSSS................", // 24
  "..............IIcSSSSSScII..............", // 25 collar
  "............IIIIIcSSSScIIIII............", // 26
  "..........IIIIIIIIcSScIIIIIIII..........", // 27
  "........IIIIIIIIIIIccIIIIIIIIII.........", // 28
  ".......IIIIIIIIIIIIiiIIIIIIIIIII........", // 29
  "......IIIIIIIIIIIIIiiIIIIIIIIIIII.......", // 30
  ".....IIIIIIIIIIIIIIiIIIIIIILIIIII.......", // 31 logo
  "....IIIIIIIIIIIIIIIiIIIIIILLLIIIII......", // 32
  "....IIIIIIIIIIIIIIIiIIIIIIL.LIIIII......", // 33
  "...IIIIIIIIIIIIIIIIiIIIIIIIIIIIIIII.....", // 34
  "...IIIIIIIIIIIIIIIIiIIIIIIIIIIIIIII.....", // 35
  "...IIIIIIIIIIIIIIIIiIIIIIIIIIIIIIII.....", // 36
  "...IIIIIIIIIIIIIIIIiIIIIIIIIIIIIIII.....", // 37
  "...IIIIIIIIIIIIIIIIiIIIIIIIIIIIIIII.....", // 38
  "...IIIIIIIIIIIIIIIIiIIIIIIIIIIIIIII.....", // 39
);

/**
 * Eye geometry. Each eye is a 3×2 white with a 1×2 pupil that the renderer
 * offsets by `dx` (−1..1) and `dy` (−1..1, clipped to the eye rows).
 */
export const EYE = {
  rowTop: 14,
  height: 2,
  width: 3,
  /** Left x of each eye white. */
  lefts: [14, 22] as const,
  /** Pupil x relative to the eye left when looking straight ahead. */
  pupilOffset: 1,
} as const;

/** Closed eye: a lash line over the lower eye row. */
export const EYE_CLOSED = grid("SSS", "KKK");

/*
 * Props are drawn over the body. Each carries its own hand and forearm so a
 * state swaps one layer, never several.
 */

/** Hand cupped to the ear (listening). Anchored beside the right cheek. */
// prettier-ignore
export const HAND_EAR: SpriteLayer = {
  x: 27,
  y: 12,
  grid: grid(
    "..SSS...",
    ".SSSSS..",
    ".SSSSs..",
    "..sSSs..",
    "...SSs..",
    "...SSs..",
    "...SSs..",
    "...SSs..",
    "...SSs..",
    "..SSs...",
    "..SSs...",
    ".SSs....",
    ".SSs....",
    "SSs.....",
  ),
};

/** Phone at the ear (connecting). Anchored like the cupped hand. */
// prettier-ignore
export const PHONE_EAR: SpriteLayer = {
  x: 27,
  y: 11,
  grid: grid(
    "DDD.....",
    "DgD.....",
    "DgDSS...",
    "DgSSSS..",
    "DDSSSs..",
    "..sSSs..",
    "...SSs..",
    "...SSs..",
    "...SSs..",
    "...SSs..",
    "..SSs...",
    "..SSs...",
    ".SSs....",
    ".SSs....",
    "SSs.....",
  ),
};

/** Hand on the chin (solving). Anchored under the moustache, right side. */
// prettier-ignore
export const HAND_CHIN: SpriteLayer = {
  x: 20,
  y: 21,
  grid: grid(
    "SSSSS...",
    "sSSSSS..",
    ".ssSSSs.",
    "....SSs.",
    "....SSs.",
    "....SSs.",
    "....SSs.",
    ".....SSs",
    ".....SSs",
  ),
};

/** Wrench raised in the right hand (working). Two arm poses. */
// prettier-ignore
export const WRENCH_UP: SpriteLayer = {
  x: 28,
  y: 6,
  grid: grid(
    "..GG.GG.",
    "..GgggG.",
    "...GgG..",
    "...GgG..",
    "...GgG..",
    "..SGgGS.",
    ".SSSGSSS",
    ".SSSSSSs",
    "..sSSSs.",
    "...SSs..",
    "...SSs..",
    "...SSs..",
    "..SSs...",
    "..SSs...",
    "..SSs...",
    ".SSs....",
    ".SSs....",
    "SSs.....",
  ),
};

// prettier-ignore
export const WRENCH_DOWN: SpriteLayer = {
  x: 28,
  y: 9,
  grid: grid(
    "..GG.GG.",
    "..GgggG.",
    "...GgG..",
    "...GgG..",
    "..SGgGS.",
    ".SSSGSSS",
    ".SSSSSSs",
    "..sSSSs.",
    "...SSs..",
    "...SSs..",
    "...SSs..",
    "..SSs...",
    "..SSs...",
    ".SSs....",
    "SSs.....",
  ),
};

/** Magnifying glass raised in the left hand (searching). */
// prettier-ignore
export const MAGNIFIER: SpriteLayer = {
  x: 3,
  y: 8,
  grid: grid(
    "..GGGG...",
    ".GggbbG..",
    "GgbbbbbG.",
    "GgbbbbbG.",
    "GbbbbbbG.",
    "GbbbbbbG.",
    ".GbbbbG..",
    "..GGGG...",
    "....SGS..",
    "...SSSSS.",
    "...sSSSSS",
    "....sSSS.",
    ".....sSS.",
    ".....sSS.",
    "......sSS",
    "......sSS",
    ".......sS",
    ".......sS",
    "........s",
  ),
};

/** Pen over a clipboard, held at chest height (composing). Two hand poses. */
// prettier-ignore
export const PEN_LEFT: SpriteLayer = {
  x: 20,
  y: 24,
  grid: grid(
    ".......D..",
    "......DD..",
    ".....DgD..",
    "....SSSD..",
    "...SSSSS..",
    "...sSSSs..",
    "....sSSs..",
    ".....SSs..",
    ".....SSs..",
    "......SSs.",
    "......SSs.",
    ".......SSs",
  ),
};

// prettier-ignore
export const PEN_RIGHT: SpriteLayer = {
  x: 21,
  y: 24,
  grid: grid(
    "........D.",
    ".......DD.",
    "......DgD.",
    ".....SSSD.",
    "....SSSSS.",
    "....sSSSs.",
    ".....sSSs.",
    "......SSs.",
    "......SSs.",
    "......SSs.",
    ".......SSs",
    ".......SSs",
  ),
};

/*
 * Effects float above or beside the head and cycle between frames.
 */

/** Thought dots, growing. */
export const THOUGHT_DOTS: SpriteLayer[] = [
  { x: 29, y: 4, grid: grid("B.....") },
  { x: 29, y: 4, grid: grid("B..B..") },
  { x: 29, y: 4, grid: grid("B..B..B") },
];

/** Signal arcs beside the phone, growing outward. */
// prettier-ignore
export const SIGNAL_ARCS: SpriteLayer[] = [
  { x: 32, y: 6, grid: grid(
    ".......",
    "B......",
    ".B.....",
    ".B.....",
    "B......",
  ) },
  { x: 32, y: 6, grid: grid(
    "..B....",
    "B..B...",
    ".B..B..",
    ".B..B..",
    "B..B...",
    "..B....",
  ) },
  { x: 32, y: 5, grid: grid(
    ".....B.",
    "..B...B",
    "B..B...",
    ".B..B.B",
    ".B..B.B",
    "B..B...",
    "..B...B",
    ".....B.",
  ) },
];

/** Sparkle of a job done right, twinkling. */
// prettier-ignore
export const SPARKLE: SpriteLayer[] = [
  { x: 6, y: 5, grid: grid(
    ".b.",
    "bBb",
    ".b.",
  ) },
  { x: 5, y: 4, grid: grid(
    "..B..",
    "..b..",
    "BbBbB",
    "..b..",
    "..B..",
  ) },
];

/** Sound waves entering the cupped ear (listening). */
// prettier-ignore
export const SOUND_WAVES: SpriteLayer[] = [
  { x: 34, y: 12, grid: grid(
    "b..",
    ".b.",
    ".b.",
    "b..",
  ) },
  { x: 34, y: 11, grid: grid(
    "b.B.",
    ".b.B",
    ".b.B",
    ".b.B",
    "b.B.",
  ) },
];
