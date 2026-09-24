import { DON_VICTOR_PALETTE, type PaletteKey } from "./don-victor-palette";
import type { SpriteFrame } from "./don-victor-choreography";
import {
  BODY,
  EYE,
  EYE_CLOSED,
  SPRITE_SIZE,
  type SpriteGrid,
} from "./don-victor-sprites";

type Rgb = readonly [number, number, number];

const RGB_BY_KEY = new Map<PaletteKey, Rgb | null>(
  (Object.keys(DON_VICTOR_PALETTE) as PaletteKey[]).map((key) => {
    const hex = DON_VICTOR_PALETTE[key];

    if (!hex) {
      return [key, null];
    }

    const value = Number.parseInt(hex.slice(1), 16);
    return [key, [(value >> 16) & 255, (value >> 8) & 255, value & 255]];
  }),
);

/** Sprite pixels as RGBA, row-major, `SPRITE_SIZE` square. */
export type SpritePixels = Uint8ClampedArray<ArrayBuffer>;

export function createSpritePixels(): SpritePixels {
  return new Uint8ClampedArray(new ArrayBuffer(SPRITE_SIZE * SPRITE_SIZE * 4));
}

function paintGrid(
  pixels: SpritePixels,
  grid: SpriteGrid,
  originX: number,
  originY: number,
) {
  for (let row = 0; row < grid.height; row += 1) {
    const y = originY + row;

    if (y < 0 || y >= SPRITE_SIZE) {
      continue;
    }

    const line = grid.rows[row]!;

    for (let column = 0; column < grid.width; column += 1) {
      const x = originX + column;

      if (x < 0 || x >= SPRITE_SIZE) {
        continue;
      }

      const rgb = RGB_BY_KEY.get(line[column] as PaletteKey);

      if (!rgb) {
        continue;
      }

      const offset = (y * SPRITE_SIZE + x) * 4;
      pixels[offset] = rgb[0];
      pixels[offset + 1] = rgb[1];
      pixels[offset + 2] = rgb[2];
      pixels[offset + 3] = 255;
    }
  }
}

function paintPixel(
  pixels: SpritePixels,
  x: number,
  y: number,
  key: PaletteKey,
) {
  const rgb = RGB_BY_KEY.get(key);

  if (!rgb || x < 0 || y < 0 || x >= SPRITE_SIZE || y >= SPRITE_SIZE) {
    return;
  }

  const offset = (y * SPRITE_SIZE + x) * 4;
  pixels[offset] = rgb[0];
  pixels[offset + 1] = rgb[1];
  pixels[offset + 2] = rgb[2];
  pixels[offset + 3] = 255;
}

function paintEyes(pixels: SpritePixels, frame: SpriteFrame, closed: boolean) {
  const top = EYE.rowTop + frame.bob;

  for (const left of EYE.lefts) {
    if (closed) {
      paintGrid(pixels, EYE_CLOSED, left, top);
      continue;
    }

    for (let row = 0; row < EYE.height; row += 1) {
      for (let column = 0; column < EYE.width; column += 1) {
        paintPixel(pixels, left + column, top + row, "W");
      }
    }

    const pupilX = left + EYE.pupilOffset + frame.pupil.dx;

    // A vertical glance shrinks the pupil to the row it leans toward.
    if (frame.pupil.dy === 0) {
      paintPixel(pixels, pupilX, top, "P");
      paintPixel(pixels, pupilX, top + 1, "P");
    } else {
      paintPixel(pixels, pupilX, top + (frame.pupil.dy > 0 ? 1 : 0), "P");
    }
  }
}

/**
 * Composes one frame into `pixels`: body, then eyes, then the frame's props
 * and effects, all shifted by the frame's bob. Pure — no canvas involved, so
 * it can run anywhere (tests, previews, a worker).
 */
export function composeFrame(
  pixels: SpritePixels,
  frame: SpriteFrame,
  eyesClosed: boolean,
): SpritePixels {
  pixels.fill(0);
  paintGrid(pixels, BODY, 0, frame.bob);
  paintEyes(pixels, frame, eyesClosed);

  for (const layer of frame.layers) {
    paintGrid(pixels, layer.grid, layer.x, layer.y + frame.bob);
  }

  return pixels;
}
