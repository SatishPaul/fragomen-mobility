/**
 * Web Worker host for the in-browser Kokoro TTS engine. Synthesis is heavy
 * WASM compute — running it here keeps the page responsive while scenes
 * generate. Messages: {id, text, voice, modelId} in; progress updates and a
 * transferred Float32Array out.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let enginePromise: Promise<any> | null = null;

const scope = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (msg: unknown, transfer?: Transferable[]) => void;
};

async function getEngine(modelId: string, dtype: string, onPct: (pct: number) => void) {
  if (!enginePromise) {
    enginePromise = (async () => {
      const { KokoroTTS } = await import("kokoro-js");
      try {
        // Silence onnxruntime's benign execution-provider warnings.
        const { env } = await import("@huggingface/transformers");
        (env.backends.onnx as { logLevel?: string }).logLevel = "fatal";
      } catch {}
      // WASM only: the WebGPU backend produces corrupted audio on several
      // GPU/driver combinations. dtype comes from the page: q8 on desktop,
      // q4 on mobile (half the download, quality still good).
      return await KokoroTTS.from_pretrained(modelId, {
        dtype: dtype as "q8" | "q4",
        device: "wasm",
        progress_callback: (p: { status: string; progress?: number }) => {
          if (p.status === "progress" && typeof p.progress === "number") {
            onPct(p.progress);
          }
        },
      });
    })();
    enginePromise.catch(() => (enginePromise = null));
  }
  return enginePromise;
}

scope.onmessage = async (e: MessageEvent) => {
  const { id, text, voice, modelId, dtype, warm } = e.data as {
    id: number;
    text: string;
    voice: string;
    modelId: string;
    dtype: string;
    /** Load/download the model only — no synthesis. Used for prefetching. */
    warm?: boolean;
  };
  try {
    const engine = await getEngine(modelId, dtype || "q8", (pct) =>
      scope.postMessage({ id, progress: pct }),
    );
    if (warm) {
      scope.postMessage({ id, ok: true, warmed: true });
      return;
    }
    const audio = await engine.generate(text, { voice });
    const data = audio.audio as Float32Array;
    scope.postMessage(
      { id, ok: true, data, sampleRate: audio.sampling_rate as number },
      [data.buffer],
    );
  } catch (err) {
    scope.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
