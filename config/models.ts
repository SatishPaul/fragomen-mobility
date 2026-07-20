/**
 * AI model config. Free-tier OpenRouter models are targeted; free models come
 * and go, so if one disappears just swap the ID here (or set the env var) —
 * no code changes needed. Browse models at https://openrouter.ai/models?q=free
 */
export const models = {
  /** Vision model used to caption each photo / video frame. */
  vision:
    process.env.OPENROUTER_VISION_MODEL ?? "google/gemma-4-26b-a4b-it:free",
  /** Text model used to write the narration script. */
  script: process.env.OPENROUTER_SCRIPT_MODEL ?? "openai/gpt-oss-20b:free",
  /** OpenRouter endpoint. */
  baseUrl: "https://openrouter.ai/api/v1",
} as const;

/**
 * Groq fallback for the analyze/script routes. Free OpenRouter models are
 * frequently rate-limited or withdrawn; when GROQ_API_KEY is set, each route
 * retries on Groq's free tier before giving up.
 */
export const groqFallback = {
  baseUrl: "https://api.groq.com/openai/v1",
  vision:
    process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct",
  script: process.env.GROQ_SCRIPT_MODEL ?? "openai/gpt-oss-120b",
  /**
   * Tried in order when the primary script model fails — each Groq model has
   * its own rate-limit budget, so a different model dodges a 429 on the first.
   */
  scriptFallbacks: ["llama-3.3-70b-versatile", "qwen/qwen3-32b"],
} as const;

/**
 * Server-proxied TTS (optional, better voice quality than the in-browser
 * fallback). Two providers are supported:
 *  - "groq":       Groq's TTS on their free tier — set GROQ_API_KEY.
 *  - "openrouter": OpenAI gpt-audio via OpenRouter — requires purchased
 *                  OpenRouter credits (OpenRouter has NO free TTS models).
 * A third option needs no key at all:
 *  - "local":      Kokoro-82M running inside the API route (Node ONNX, CPU).
 *                  No download for visitors, no rate limits, works offline.
 * With TTS_PROVIDER=auto (default): Groq is used when GROQ_API_KEY is set,
 * otherwise the local server voice. The local voices are additionally offered
 * alongside Groq/OpenRouter voices whenever those are active. Set
 * TTS_PROVIDER=off to disable all server TTS (in-browser voices only).
 */
export const serverTts = {
  provider: (process.env.TTS_PROVIDER ?? "auto") as
    | "auto"
    | "groq"
    | "openrouter"
    | "local"
    | "off",
  openrouterModel: process.env.OPENROUTER_TTS_MODEL ?? "openai/gpt-audio-mini",
  /**
   * Weight precision for the local server voice. q8 matches the in-browser
   * quality at ~86 MB; fp32 (~310 MB) is marginally better but slower to load.
   */
  localDtype: (process.env.TTS_LOCAL_DTYPE ?? "q8") as "fp32" | "q8" | "q4",
  /**
   * Groq TTS model. Note: the org admin must accept this model's terms once
   * in the Groq console before it can be used
   * (https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english).
   */
  groqModel: process.env.GROQ_TTS_MODEL ?? "canopylabs/orpheus-v1-english",
} as const;

export interface VoiceOption {
  id: string;
  label: string;
  detail: string;
}

/** Voices offered per server TTS provider (editable). */
export const serverVoices: Record<"groq" | "openrouter", VoiceOption[]> = {
  // Orpheus voice ids — must match Groq's accepted list exactly
  // (the API rejects anything else: autumn diana hannah austin daniel troy).
  groq: [
    { id: "autumn", label: "Autumn", detail: "Warm female · natural" },
    { id: "diana", label: "Diana", detail: "Bright female · friendly" },
    { id: "hannah", label: "Hannah", detail: "Soft female · calm" },
    { id: "austin", label: "Austin", detail: "Deep male · confident" },
    { id: "daniel", label: "Daniel", detail: "Calm male · smooth" },
    { id: "troy", label: "Troy", detail: "Energetic male · upbeat" },
  ],
  openrouter: [
    { id: "marin", label: "Marin", detail: "Warm female · natural" },
    { id: "cedar", label: "Cedar", detail: "Deep male · natural" },
    { id: "coral", label: "Coral", detail: "Bright female · friendly" },
    { id: "echo", label: "Echo", detail: "Calm male · steady" },
  ],
};

/**
 * In-browser TTS fallback (Kokoro-82M, Apache-2.0, $0). The model (~80 MB) is
 * downloaded once on first use and cached by the browser.
 */
export const tts = {
  modelId: "onnx-community/Kokoro-82M-v1.0-ONNX",
  /** Voices offered in the UI. Full list: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX */
  voices: [
    { id: "af_heart", label: "Heart", detail: "Warm female · US English" },
    { id: "af_bella", label: "Bella", detail: "Bright female · US English" },
    { id: "af_nicole", label: "Nicole", detail: "Soft female · US English" },
    { id: "af_sarah", label: "Sarah", detail: "Clear female · US English" },
    { id: "af_nova", label: "Nova", detail: "Energetic female · US English" },
    { id: "af_sky", label: "Sky", detail: "Calm female · US English" },
    { id: "am_michael", label: "Michael", detail: "Deep male · US English" },
    { id: "am_eric", label: "Eric", detail: "Warm male · US English" },
    { id: "am_liam", label: "Liam", detail: "Confident male · US English" },
    { id: "am_puck", label: "Puck", detail: "Lively male · US English" },
    { id: "bf_emma", label: "Emma", detail: "Warm female · British English" },
    { id: "bf_isabella", label: "Isabella", detail: "Bright female · British English" },
    { id: "bm_george", label: "George", detail: "Calm male · British English" },
    { id: "bm_lewis", label: "Lewis", detail: "Deep male · British English" },
  ],
} as const;
