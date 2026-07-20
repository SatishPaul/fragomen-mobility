/**
 * Runs once when the Next.js server boots (and on every serverless cold
 * start). Preloads the server-side Kokoro voice model so the first TTS
 * request answers immediately instead of waiting out the model load.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { warmLocalTts } = await import("@/lib/server/kokoro");
    warmLocalTts();
  }
}
