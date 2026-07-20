export const serverLocalTtsAvailable = false;

export function warmLocalTts(): void {}

export async function localTts(): Promise<never> {
  throw new Error("Server-side Kokoro is unavailable on Vercel");
}