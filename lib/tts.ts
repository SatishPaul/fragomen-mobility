"use client";

import { tts as ttsConfig, type VoiceOption } from "@/config/models";
import { limits, styles } from "@/config/templates";
import { isMobile } from "./media";
import { useProject } from "./store";

/**
 * Voiceover generation. Prefers the server TTS proxy (/api/tts — a preloaded
 * local Kokoro engine, Groq, or OpenAI gpt-audio via OpenRouter) and falls
 * back to in-browser Kokoro-82M (~80 MB model, downloaded once and cached)
 * only when the server is unavailable. Generated audio lives in this module,
 * keyed by scene — Float32Arrays don't belong in the Zustand store.
 */

export interface SceneAudio {
  data: Float32Array;
  sampleRate: number;
  duration: number;
  /** Cache key parts so edits invalidate stale audio. */
  text: string;
  voice: string;
}

const sceneAudio = new Map<string, SceneAudio>();

export function getSceneAudio(assetId: string): SceneAudio | undefined {
  return sceneAudio.get(assetId);
}

export function clearSceneAudio() {
  sceneAudio.clear();
}

export type TtsProgress = { status: "downloading" | "ready"; pct: number };

// ---- Server TTS (Groq / OpenRouter) ---------------------------------------

export interface VoiceCatalog {
  /**
   * "groq" | "openrouter" | "local" for server TTS, "kokoro" when no server
   * TTS is available and voices run in the browser.
   */
  provider: string;
  voices: VoiceOption[];
}

let catalogPromise: Promise<VoiceCatalog> | null = null;

/** True when the voice id belongs to Kokoro (usable by the in-browser fallback). */
export function isBrowserVoice(voiceId: string): boolean {
  return ttsConfig.voices.some((v) => v.id === voiceId);
}

/**
 * All voices the user can pick. When server TTS is available (it normally is
 * — the backend runs a preloaded local Kokoro engine even with no API keys),
 * every listed voice is generated server-side: nothing to download, which is
 * what makes the app instantly usable on mobile connections. Only when the
 * server reports TTS off (or is unreachable) do voices run in the browser.
 */
export function getVoiceCatalog(): Promise<VoiceCatalog> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      try {
        const res = await fetch("/api/tts");
        if (res.ok) {
          const data = (await res.json()) as {
            provider: string | null;
            voices: VoiceOption[];
          };
          if (data.provider && data.voices.length) {
            return { provider: data.provider, voices: data.voices };
          }
        }
      } catch {
        // fall through to in-browser Kokoro only
      }
      return {
        provider: "kokoro",
        voices: ttsConfig.voices.map((v) => ({
          ...v,
          detail: `${v.detail} · in-browser`,
        })),
      };
    })();
  }
  return catalogPromise;
}

/**
 * Why the last server-TTS call fell back to the in-browser voice, if it did.
 * Cleared at the start of each voiceover run; shown by the voice step so a
 * server failure (e.g. Groq terms not accepted) is never silent.
 */
let serverTtsFallbackReason: string | null = null;

export function getServerTtsFallbackReason(): string | null {
  return serverTtsFallbackReason;
}

export function clearServerTtsFallbackReason() {
  serverTtsFallbackReason = null;
}

/**
 * Synthesizes one line via /api/tts; returns null when unavailable. Waits out
 * per-minute rate limits (Groq free tier: 10 requests/min) instead of
 * dropping to the in-browser voice mid-video.
 */
async function serverTtsGenerate(
  text: string,
  voice: string,
): Promise<{ data: Float32Array; sampleRate: number } | null> {
  const { provider } = await getVoiceCatalog();
  if (provider === "kokoro") return null;
  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice }),
    });
    if (res.status !== 429 || attempt >= 5) break;
    await new Promise((r) => setTimeout(r, 8000));
  }
  if (!res.ok) {
    const detail = await res
      .json()
      .then((b: { error?: string }) => b?.error ?? "")
      .catch(() => "");
    throw new Error(detail || `Server TTS failed (${res.status})`);
  }
  const { audioBase64, fallback } = (await res.json()) as {
    audioBase64: string;
    /** Set when the server substituted its local voice for a failed provider. */
    fallback?: { from: string; reason: string };
  };
  if (fallback) serverTtsFallbackReason = fallback.reason;
  const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(bytes.buffer);
    const data = new Float32Array(decoded.length);
    decoded.copyFromChannel(data, 0);
    return { data, sampleRate: decoded.sampleRate };
  } finally {
    ctx.close();
  }
}

// ---- In-browser TTS (Kokoro, in a Web Worker) -------------------------------
// Synthesis is heavy WASM compute; a worker keeps the page responsive (on the
// main thread it freezes the whole UI for the length of each scene).

interface WorkerReply {
  id: number;
  progress?: number;
  ok?: boolean;
  data?: Float32Array;
  sampleRate?: number;
  error?: string;
}

let ttsWorker: Worker | null = null;
let nextJobId = 1;
const jobs = new Map<
  number,
  {
    resolve: (r: { data: Float32Array; sampleRate: number }) => void;
    reject: (e: Error) => void;
    onProgress?: (p: TtsProgress) => void;
  }
>();

function getWorker(): Worker {
  if (!ttsWorker) {
    ttsWorker = new Worker(new URL("./tts-worker.ts", import.meta.url));
    ttsWorker.onmessage = (e: MessageEvent<WorkerReply>) => {
      const m = e.data;
      const job = jobs.get(m.id);
      if (!job) return;
      if (m.progress !== undefined) {
        job.onProgress?.({ status: "downloading", pct: m.progress });
        return;
      }
      jobs.delete(m.id);
      if (m.ok && m.data && m.sampleRate) {
        job.resolve({ data: m.data, sampleRate: m.sampleRate });
      } else {
        job.reject(new Error(m.error ?? "In-browser TTS failed"));
      }
    };
    ttsWorker.onerror = () => {
      for (const job of jobs.values()) job.reject(new Error("TTS worker crashed"));
      jobs.clear();
      ttsWorker = null;
    };
  }
  return ttsWorker;
}

/** Mobile devices get the q4 build — half the download, WASM-friendly. */
function kokoroDtype(): string {
  return isMobile() ? "q4" : "q8";
}

function kokoroGenerate(
  text: string,
  voice: string,
  onProgress?: (p: TtsProgress) => void,
): Promise<{ data: Float32Array; sampleRate: number }> {
  return new Promise((resolve, reject) => {
    const id = nextJobId++;
    jobs.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({
      id,
      text,
      voice,
      modelId: ttsConfig.modelId,
      dtype: kokoroDtype(),
    });
  });
}

let warmed = false;

/**
 * Starts the in-browser voice model download in the background (idempotent).
 * Call as soon as a browser voice is selected so the model arrives while the
 * user is still editing — instead of stalling the first "Generate" click.
 */
export function warmBrowserVoice(onProgress?: (p: TtsProgress) => void): void {
  if (warmed) return;
  warmed = true;
  const id = nextJobId++;
  jobs.set(id, {
    resolve: () => {},
    reject: () => {
      warmed = false; // allow a retry on the next call
    },
    onProgress,
  });
  getWorker().postMessage({
    id,
    warm: true,
    text: "",
    voice: "",
    modelId: ttsConfig.modelId,
    dtype: kokoroDtype(),
  });
}

/** Generates (or reuses cached) voiceover for one scene. */
export async function generateSceneAudio(
  assetId: string,
  text: string,
  voice: string,
  onProgress?: (p: TtsProgress) => void,
): Promise<SceneAudio | null> {
  const trimmed = text.trim();
  if (!trimmed) {
    sceneAudio.delete(assetId);
    return null;
  }
  const cached = sceneAudio.get(assetId);
  if (cached && cached.text === trimmed && cached.voice === voice) return cached;

  let data: Float32Array;
  let sampleRate: number;
  // Server first for every voice — the backend keeps a preloaded Kokoro
  // engine, so phones never download the model. Browser synthesis is only
  // the fallback when the server is unavailable.
  const server = await serverTtsGenerate(trimmed, voice).catch((e: Error) => {
    serverTtsFallbackReason = e.message;
    return null;
  });
  // (normalization applied below, after either path fills `data`)
  if (server) {
    ({ data, sampleRate } = server);
  } else {
    // Server TTS unavailable (or errored) — fall back to in-browser Kokoro.
    // If the selected voice belongs to a server provider, use Kokoro's default.
    const kokoroVoice = isBrowserVoice(voice) ? voice : ttsConfig.voices[0].id;
    ({ data, sampleRate } = await kokoroGenerate(trimmed, kokoroVoice, onProgress));
  }
  normalize(data);
  const result: SceneAudio = {
    data,
    sampleRate,
    duration: data.length / sampleRate,
    text: trimmed,
    voice,
  };
  sceneAudio.set(assetId, result);
  return result;
}

/** Peak-normalizes speech in place — some TTS engines output very low gain. */
function normalize(data: Float32Array, target = 0.85) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  if (peak < 0.001 || peak >= target) return;
  const gain = target / peak;
  for (let i = 0; i < data.length; i++) data[i] *= gain;
}

/** A short sample used by the voice picker's preview buttons. */
export async function previewVoice(
  voice: string,
  onProgress?: (p: TtsProgress) => void,
): Promise<{ data: Float32Array; sampleRate: number }> {
  const sample = "Welcome home. Let me show you around this beautiful property.";
  const server = await serverTtsGenerate(sample, voice).catch(() => null);
  if (server) return server;
  const kokoroVoice = isBrowserVoice(voice) ? voice : ttsConfig.voices[0].id;
  return kokoroGenerate(sample, kokoroVoice, onProgress);
}

/**
 * Generates voiceover for every scene in order, updating the store with
 * per-scene durations as they land. Returns total video length in seconds.
 */
export async function generateAllVoiceovers(
  onProgress?: (done: number, total: number, tts?: TtsProgress) => void,
): Promise<number> {
  const state = useProject.getState();
  const scenes = state.scenes;
  let done = 0;
  for (const scene of scenes) {
    state.patchScene(scene.assetId, { generating: true });
    try {
      const audio = await generateSceneAudio(
        scene.assetId,
        scene.line,
        state.voice,
        (p) => onProgress?.(done, scenes.length, p),
      );
      state.patchScene(scene.assetId, {
        generating: false,
        audioDuration: audio?.duration,
      });
    } catch (e) {
      state.patchScene(scene.assetId, { generating: false });
      throw e;
    }
    done++;
    onProgress?.(done, scenes.length);
  }
  return totalDuration();
}

/** Scene timing rule (TRD §3.2). */
export function sceneDurationFor(
  kind: "image" | "video",
  audioDuration: number | undefined,
): number {
  const narrated = (audioDuration ?? 0) + limits.scenePaddingSeconds;
  if (kind === "image") return Math.max(narrated, limits.minImageSceneSeconds);
  return Math.max(narrated, 1.5);
}

/** Projected output length including transitions and title cards. */
export function totalDuration(): number {
  const s = useProject.getState();
  const assetById = new Map(s.assets.map((a) => [a.id, a]));
  const style = styles.find((st) => st.id === s.style);
  let total = 0;
  let count = 0;
  for (const scene of s.scenes) {
    const asset = assetById.get(scene.assetId);
    if (!asset) continue;
    total += sceneDurationFor(asset.kind, getSceneAudio(scene.assetId)?.duration);
    count++;
  }
  if (count > 1) total += (count - 1) * (style?.transitionSeconds ?? 0);
  if (s.cards.title.trim()) total += 3;
  if (s.cards.outro.trim()) total += limits.outroSeconds;
  return total;
}

/** Plays a Float32Array through the speakers (voice preview). */
export function playAudio(data: Float32Array, sampleRate: number): () => void {
  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, data.length, sampleRate);
  buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  source.onended = () => ctx.close();
  return () => {
    try {
      source.stop();
      ctx.close();
    } catch {}
  };
}
