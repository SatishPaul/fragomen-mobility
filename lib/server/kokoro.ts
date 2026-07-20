import { serverTts, tts } from "@/config/models";

export const serverLocalTtsAvailable = true;

/**
 * Server-side Kokoro TTS ("local" provider). The model runs inside the Node
 * process via onnxruntime-node, so visitors — especially on mobile — never
 * download the ~80 MB model; they just receive small WAV responses. The
 * engine is a module-level singleton, warmed at server startup (see
 * instrumentation.ts) so the first synthesis request doesn't pay the load.
 */

// kokoro-js ships no type declarations for the engine instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KokoroEngine = any;

// The singleton lives on globalThis: Next bundles this module separately
// into the instrumentation entry and the API route, so a plain module-level
// variable would give each bundle its own engine (double load, double RAM).
const g = globalThis as unknown as { __kokoroEnginePromise?: Promise<KokoroEngine> | null };

async function loadEngine(): Promise<KokoroEngine> {
  const { env } = await import("@huggingface/transformers");
  // Serverless filesystems are read-only outside /tmp — cache model weights
  // there. Local `next dev`/`next start` keeps the default persistent cache.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    env.cacheDir = "/tmp/transformers-cache";
  }
  const { KokoroTTS } = await import("kokoro-js");
  const started = Date.now();
  const engine = await KokoroTTS.from_pretrained(tts.modelId, {
    dtype: serverTts.localDtype,
    device: "cpu",
  });
  console.log(`[tts] local Kokoro engine ready in ${Date.now() - started}ms`);
  return engine;
}

export function getLocalEngine(): Promise<KokoroEngine> {
  if (!g.__kokoroEnginePromise) {
    const promise = loadEngine();
    g.__kokoroEnginePromise = promise;
    // A failed load (network hiccup while fetching weights) must not poison
    // every future request — allow a retry on the next call.
    promise.catch(() => {
      if (g.__kokoroEnginePromise === promise) g.__kokoroEnginePromise = null;
    });
  }
  return g.__kokoroEnginePromise;
}

/** Starts loading the model in the background (idempotent, never throws). */
export function warmLocalTts(): void {
  if (serverTts.provider === "off") return;
  getLocalEngine().catch((e) =>
    console.error("[tts] local engine warm-up failed:", e instanceof Error ? e.message : e),
  );
}

/** Synthesizes one line to a base64-encoded 16-bit PCM WAV. */
export async function localTts(text: string, voice: string): Promise<string> {
  const engine = await getLocalEngine();
  // Guard against stale clients sending a non-Kokoro voice id.
  const kokoroVoice = tts.voices.some((v) => v.id === voice) ? voice : tts.voices[0].id;
  const audio = await engine.generate(text, { voice: kokoroVoice });
  return encodeWavBase64(audio.audio as Float32Array, audio.sampling_rate as number);
}

function encodeWavBase64(samples: Float32Array, sampleRate: number): string {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf.toString("base64");
}
