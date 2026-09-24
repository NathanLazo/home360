import {
  HAND_CHIN,
  HAND_EAR,
  MAGNIFIER,
  PEN_LEFT,
  PEN_RIGHT,
  PHONE_EAR,
  SIGNAL_ARCS,
  SOUND_WAVES,
  SPARKLE,
  THOUGHT_DOTS,
  WRENCH_DOWN,
  WRENCH_UP,
  type SpriteLayer,
} from "./don-victor-sprites";

/**
 * What Don Víctor is doing. Mirrors the orb states the agent already derives
 * (`agent-orb-state.ts`) so one signal drives both the orb and the sprite.
 */
export type DonVictorState =
  | "breathing"
  | "listening"
  | "connecting"
  | "searching"
  | "working"
  | "solving"
  | "composing";

export type PupilOffset = { dx: -1 | 0 | 1; dy: -1 | 0 | 1 };

export type SpriteFrame = {
  /** Props and effects, painted over the body in order. */
  layers: SpriteLayer[];
  pupil: PupilOffset;
  /** Whole-sprite vertical offset in sprite pixels (breathing). */
  bob: number;
};

export type Choreography = {
  /** Sprite ticks per second — classic pixel-art cadence, never 60. */
  fps: number;
  frames: SpriteFrame[];
  /** Whether random blinks overlay this state. */
  blink: boolean;
};

const AHEAD: PupilOffset = { dx: 0, dy: 0 };

function frame(
  layers: SpriteLayer[],
  pupil: PupilOffset = AHEAD,
  bob = 0,
): SpriteFrame {
  return { layers, pupil, bob };
}

/**
 * Per-state frame plans. Breathing is a slow 2-pose bob; every other state
 * keeps the bob and adds a prop pose plus a cycling effect, so the switch
 * between states reads as "he picked something up", not as a cut.
 */
export const CHOREOGRAPHY: Record<DonVictorState, Choreography> = {
  breathing: {
    fps: 2,
    blink: true,
    frames: [frame([], AHEAD, 0), frame([], AHEAD, 1)],
  },
  listening: {
    fps: 3,
    blink: true,
    frames: [
      frame([HAND_EAR, SOUND_WAVES[0]!], { dx: 1, dy: 1 }, 0),
      frame([HAND_EAR, SOUND_WAVES[1]!], { dx: 1, dy: 1 }, 0),
      frame([HAND_EAR, SOUND_WAVES[1]!], { dx: 1, dy: 1 }, 1),
      frame([HAND_EAR, SOUND_WAVES[0]!], { dx: 1, dy: 1 }, 1),
    ],
  },
  connecting: {
    fps: 4,
    blink: true,
    frames: [
      frame([PHONE_EAR, SIGNAL_ARCS[0]!], AHEAD, 0),
      frame([PHONE_EAR, SIGNAL_ARCS[1]!], AHEAD, 0),
      frame([PHONE_EAR, SIGNAL_ARCS[2]!], AHEAD, 1),
      frame([PHONE_EAR], AHEAD, 1),
    ],
  },
  searching: {
    fps: 3,
    blink: false,
    frames: [
      frame([MAGNIFIER], { dx: -1, dy: 0 }, 0),
      frame([MAGNIFIER], { dx: -1, dy: 0 }, 0),
      frame([MAGNIFIER], { dx: 0, dy: 0 }, 1),
      frame([MAGNIFIER], { dx: 1, dy: 0 }, 1),
      frame([MAGNIFIER], { dx: 1, dy: 0 }, 1),
      frame([MAGNIFIER], { dx: 0, dy: 0 }, 0),
    ],
  },
  working: {
    fps: 5,
    blink: true,
    frames: [
      frame([WRENCH_UP], { dx: 1, dy: -1 }, 0),
      frame([WRENCH_UP, SPARKLE[0]!], { dx: 1, dy: -1 }, 0),
      frame([WRENCH_DOWN, SPARKLE[1]!], { dx: 1, dy: 0 }, 1),
      frame([WRENCH_DOWN], { dx: 1, dy: 0 }, 1),
    ],
  },
  solving: {
    fps: 2,
    blink: true,
    frames: [
      frame([HAND_CHIN, THOUGHT_DOTS[0]!], { dx: 1, dy: -1 }, 0),
      frame([HAND_CHIN, THOUGHT_DOTS[1]!], { dx: 1, dy: -1 }, 0),
      frame([HAND_CHIN, THOUGHT_DOTS[2]!], { dx: 0, dy: -1 }, 1),
      frame([HAND_CHIN, THOUGHT_DOTS[2]!], { dx: -1, dy: 0 }, 1),
    ],
  },
  composing: {
    fps: 6,
    blink: true,
    frames: [
      frame([PEN_LEFT], { dx: 0, dy: 1 }, 0),
      frame([PEN_RIGHT], { dx: 0, dy: 1 }, 0),
      frame([PEN_LEFT], { dx: 0, dy: 1 }, 1),
      frame([PEN_RIGHT], { dx: 0, dy: 1 }, 1),
    ],
  },
};

export const DON_VICTOR_STATES = Object.keys(CHOREOGRAPHY) as DonVictorState[];
