import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveSession } from "~/server/auth/resolve-session";
import {
  TRANSCRIPTION_MEDIA_TYPES,
  transcribeAudio,
} from "~/server/services/ai/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Decoded audio cap (~2 min voice note). */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/** Base64 grows 4/3 over the bytes; the schema rejects anything larger. */
const MAX_AUDIO_BASE64_CHARS = Math.ceil(MAX_AUDIO_BYTES / 3) * 4;

const requestSchema = z.object({
  audioBase64: z
    .string()
    .min(1)
    .max(MAX_AUDIO_BASE64_CHARS)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/u),
  mediaType: z.enum(TRANSCRIPTION_MEDIA_TYPES),
  locale: z.enum(["es", "en"]).default("es"),
});

type TranscribeErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "AI_UNAVAILABLE"
  | "TRANSCRIPTION_EMPTY";

const ERROR_STATUS: Record<TranscribeErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
  AI_UNAVAILABLE: 503,
  TRANSCRIPTION_EMPTY: 422,
};

function failure(code: TranscribeErrorCode, message: string) {
  const status = ERROR_STATUS[code];
  return NextResponse.json(
    { result: null, error: code, status, message },
    { status },
  );
}

/**
 * Voice-note transcription for the mobile concierge (Bearer session, any
 * signed-in role). Answers the `TrpcResponse` envelope as JSON; the work
 * lives in `services/ai/transcribe.ts`.
 */
export async function POST(request: Request) {
  const session = await resolveSession(request.headers);

  if (!session) {
    return failure("UNAUTHORIZED", "Sign in required");
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return failure("VALIDATION_ERROR", "Body must be JSON");
  }

  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return failure("VALIDATION_ERROR", "Invalid transcription request");
  }

  const audio = Buffer.from(parsed.data.audioBase64, "base64");

  if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) {
    return failure("VALIDATION_ERROR", "Audio must be 8 MB or smaller");
  }

  const transcribed = await transcribeAudio({
    audio: new Uint8Array(audio),
    mediaType: parsed.data.mediaType,
    locale: parsed.data.locale,
  });

  if (!transcribed.ok) {
    return transcribed.code === "TRANSCRIPTION_EMPTY"
      ? failure("TRANSCRIPTION_EMPTY", "No speech detected")
      : failure("AI_UNAVAILABLE", "Transcription unavailable");
  }

  return NextResponse.json({
    result: { text: transcribed.data.text },
    error: null,
    status: 200,
    message: "Audio transcribed",
  });
}
