import "server-only";

import { generateText } from "ai";

import { env } from "~/env";
import { svcFail, svcOk, type ServiceResult } from "../service-result";

/**
 * Multimodal gateway model that accepts audio input. Gemini Flash reads audio
 * natively through the Vercel AI Gateway (`AI_GATEWAY_API_KEY`), is fast and
 * cheap for short voice notes. Swap it here if the gateway retires the id.
 */
const TRANSCRIPTION_MODEL = "google/gemini-3-flash";

/** Voice notes are ≤ ~2 min; the model answers well within this budget. */
const TRANSCRIPTION_TIMEOUT_MS = 45_000;

export const TRANSCRIPTION_MEDIA_TYPES = [
  "audio/m4a",
  "audio/mp4",
  "audio/aac",
  "audio/webm",
  "audio/wav",
  "audio/mpeg",
] as const;

export type TranscriptionMediaType = (typeof TRANSCRIPTION_MEDIA_TYPES)[number];

export type TranscriptionInput = {
  audio: Uint8Array;
  mediaType: TranscriptionMediaType;
  locale: "es" | "en";
};

type TranscriptionError = "AI_UNAVAILABLE" | "TRANSCRIPTION_EMPTY";

const LANGUAGE_HINT: Record<TranscriptionInput["locale"], string> = {
  es: "The speaker most likely talks in Spanish (Mexico).",
  en: "The speaker most likely talks in English.",
};

/**
 * iOS records `.m4a` and some clients label it `audio/m4a`, which is not an
 * IANA type; providers expect the MP4 container type for it.
 */
function providerMediaType(mediaType: TranscriptionMediaType): string {
  return mediaType === "audio/m4a" ? "audio/mp4" : mediaType;
}

function buildInstructions(locale: TranscriptionInput["locale"]): string {
  return [
    "You are a speech-to-text engine for HOME360, a home-maintenance app.",
    "Transcribe the audio literally, in the language actually spoken.",
    LANGUAGE_HINT[locale],
    "Output only the transcription: no comments, no quotes, no labels, no",
    "translation and no summary. Add normal punctuation.",
    "If there is no intelligible speech, output nothing.",
  ].join("\n");
}

/**
 * Transcribes a short voice note (concierge chat) through the AI Gateway.
 * Provider errors never leak: they are logged and surface as AI_UNAVAILABLE;
 * silence or noise answers TRANSCRIPTION_EMPTY.
 */
export async function transcribeAudio(
  input: TranscriptionInput,
): Promise<ServiceResult<{ text: string }, TranscriptionError>> {
  if (!env.AI_GATEWAY_API_KEY) {
    return svcFail("AI_UNAVAILABLE", "AI gateway key is not configured");
  }

  let text: string;

  try {
    const result = await generateText({
      model: TRANSCRIPTION_MODEL,
      instructions: buildInstructions(input.locale),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: { type: "data", data: input.audio },
              mediaType: providerMediaType(input.mediaType),
            },
            { type: "text", text: "Transcribe this audio." },
          ],
        },
      ],
      abortSignal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
    });
    text = result.text.trim();
  } catch (error) {
    console.error(
      "[ai/transcribe] generation failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );

    return svcFail("AI_UNAVAILABLE", "Transcription failed");
  }

  if (text.length === 0) {
    return svcFail("TRANSCRIPTION_EMPTY", "No speech detected");
  }

  return svcOk({ text });
}
