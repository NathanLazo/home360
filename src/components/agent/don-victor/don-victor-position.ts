/**
 * Where the widget rests inside the chat, persisted per browser. The side
 * is what the magnet decides; `top` is the offset from the top of the drag
 * bounds in px and is clamped again on restore, since the chat may be a
 * different height next time. Docked to the composer the widget sits on its
 * top edge and keeps the horizontal offset `left` instead.
 */
export type DonVictorSide = "left" | "right";

export type DonVictorPosition =
  { side: DonVictorSide; top: number } | { side: "composer"; left: number };

const STORAGE_KEY = "home360.agent.victor.position";

export const DEFAULT_DON_VICTOR_POSITION: DonVictorPosition = {
  side: "right",
  top: Number.POSITIVE_INFINITY,
};

function isSide(value: unknown): value is DonVictorSide {
  return value === "left" || value === "right";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function readDonVictorPosition(): DonVictorPosition {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_DON_VICTOR_POSITION;
    }

    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed === "object" && parsed !== null && "side" in parsed) {
      if (
        parsed.side === "composer" &&
        "left" in parsed &&
        isFiniteNumber(parsed.left)
      ) {
        return { side: "composer", left: parsed.left };
      }

      if (
        isSide(parsed.side) &&
        "top" in parsed &&
        isFiniteNumber(parsed.top)
      ) {
        return { side: parsed.side, top: parsed.top };
      }
    }
  } catch {
    // Storage blocked: the default position applies.
  }

  return DEFAULT_DON_VICTOR_POSITION;
}

export function writeDonVictorPosition(position: DonVictorPosition) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Position stays for this page view only.
  }
}
