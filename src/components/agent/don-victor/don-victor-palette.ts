/**
 * Illustration palette for the Don Víctor pixel sprite. These are sprite
 * colours, not UI tokens: the polo and outlines borrow the ink of the design
 * system so the character reads as part of the same page, while skin and hair
 * are the character's own. Keys are the single characters used in the grids.
 */
export const DON_VICTOR_PALETTE = {
  /** Transparent. */
  ".": null,
  /** Hair and moustache. */
  K: "#141414",
  /** Hair sheen. */
  k: "#3a3a3a",
  /** Skin. */
  S: "#e6b58e",
  /** Skin shadow. */
  s: "#c98f62",
  /** Eye white and teeth. */
  W: "#ffffff",
  /** Pupil. */
  P: "#101010",
  /** Mouth. */
  M: "#7a3a3a",
  /** Polo — the system's ink. */
  I: "#171717",
  /** Polo sheen. */
  i: "#2c2c2c",
  /** Collar edge. */
  c: "#454545",
  /** Logo. */
  L: "#ffffff",
  /** Prop metal (wrench, magnifier rim, phone). */
  G: "#8a8a8a",
  /** Prop metal highlight. */
  g: "#d4d4d4",
  /** Prop dark (pen body, phone body). */
  D: "#262626",
  /** Signal / thought accent — the system's link blue. */
  B: "#0070f3",
  /** Soft accent. */
  b: "#7fb4ff",
} as const;

export type PaletteKey = keyof typeof DON_VICTOR_PALETTE;
