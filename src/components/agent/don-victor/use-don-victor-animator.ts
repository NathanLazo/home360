"use client";

import { type RefObject, useEffect } from "react";

import { CHOREOGRAPHY, type DonVictorState } from "./don-victor-choreography";
import { composeFrame, createSpritePixels } from "./don-victor-renderer";
import { SPRITE_SIZE } from "./don-victor-sprites";

/** Blink cadence: a human-ish 2.4–5.2 s apart, eyes shut for ~140 ms. */
const BLINK_MIN_GAP_MS = 2400;
const BLINK_MAX_GAP_MS = 5200;
const BLINK_HOLD_MS = 140;

function nextBlinkDelay() {
  return (
    BLINK_MIN_GAP_MS + Math.random() * (BLINK_MAX_GAP_MS - BLINK_MIN_GAP_MS)
  );
}

export type DonVictorAnimatorOptions = {
  state: DonVictorState;
  /** Rendered size in CSS px (square). */
  size: number;
  /** Paint the first frame only, no loop, no blinks. */
  reduceMotion: boolean;
};

/**
 * Drives a `<canvas>` with the sprite's frame plan. The sprite is composed
 * at 1:1 into an offscreen canvas and scaled up with smoothing off, so the
 * pixels stay crisp at any DPR. The loop only repaints when the frame index
 * or the blink state changes; between ticks it costs one comparison.
 */
export function useDonVictorAnimator(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  { state, size, reduceMotion }: DonVictorAnimatorOptions,
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.round((size * dpr) / SPRITE_SIZE));
    canvas.width = SPRITE_SIZE * scale;
    canvas.height = SPRITE_SIZE * scale;

    const offscreen = document.createElement("canvas");
    offscreen.width = SPRITE_SIZE;
    offscreen.height = SPRITE_SIZE;
    const offscreenContext = offscreen.getContext("2d");

    if (!offscreenContext) {
      return;
    }

    const pixels = createSpritePixels();
    const choreography = CHOREOGRAPHY[state];
    const frameCount = choreography.frames.length;
    const tickMs = 1000 / choreography.fps;

    const paint = (frameIndex: number, eyesClosed: boolean) => {
      const frame = choreography.frames[frameIndex]!;
      composeFrame(pixels, frame, eyesClosed);
      offscreenContext.putImageData(
        new ImageData(pixels, SPRITE_SIZE, SPRITE_SIZE),
        0,
        0,
      );
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;
      context.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
    };

    paint(0, false);

    if (reduceMotion) {
      return;
    }

    const start = performance.now();
    let paintedFrame = 0;
    let paintedClosed = false;
    let blinkAt = start + nextBlinkDelay();
    let blinkUntil = 0;
    let rafId = 0;

    const loop = (now: number) => {
      rafId = window.requestAnimationFrame(loop);

      const frameIndex = Math.floor((now - start) / tickMs) % frameCount;

      if (choreography.blink && now >= blinkAt) {
        blinkUntil = now + BLINK_HOLD_MS;
        blinkAt = now + BLINK_HOLD_MS + nextBlinkDelay();
      }

      const eyesClosed = choreography.blink && now < blinkUntil;

      if (frameIndex !== paintedFrame || eyesClosed !== paintedClosed) {
        paintedFrame = frameIndex;
        paintedClosed = eyesClosed;
        paint(frameIndex, eyesClosed);
      }
    };

    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [canvasRef, state, size, reduceMotion]);
}
