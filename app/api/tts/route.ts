import { NextResponse } from "next/server";
import { z } from "zod";
import { models, serverTts, serverVoices, tts } from "@/config/models";
import {
  localTts,
  warmLocalTts,
} from "@/lib/server/kokoro";
import { clientIp, throttled } from "@/lib/server/throttle";
import { finalizeUsage, QuotaError, reserveUsage } from "@/lib/server/usage";

/**
 * Server TTS. GET reports which provider is active plus the voice list; POST
 * synthesizes one narration line to WAV. Keys stay server-side. The "local"
 * provider runs Kokoro-82M inside this Node process (preloaded at boot via
 * instrumentation.ts) — so even with no API keys, voices are generated on
 * the server and mobile browsers never download the model. The in-browser
 * engine remains only as a client-side fallback if this route errors.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

type Provider = "groq" | "openrouter" | "local" | null;
const serverLocalTtsAvailable = !process.env.VERCEL;

/**
 * Whether Groq TTS actually works — a key alone isn't enough (the model's
 * terms must be accepted once in the Groq console, a manual step nobody
 * should have to know about). Probed once per server instance with a tiny
 * request; on any failure the app silently uses the local server voice, so
 * a misconfigured key never surfaces to visitors. Cached on globalThis
 * because Next bundles this module into several entries.
 */
function groqUsable(): Promise<boolean> {
  const g = globalThis as unknown as { __groqTtsProbe?: Promise<boolean> };
  if (!g.__groqTtsProbe) {
    g.__groqTtsProbe = (async () => {
      try {
        await Promise.race([
          groqTts("Hi.", serverVoices.groq[0].id),
          new Promise((_, reject) =>
            setTimeout(() => reject(new TtsError(504, "probe timed out")), 8000),
          ),
        ]);
        return true;
      } catch (e) {
        // Rate-limited means the key and terms are fine.
        if (e instanceof TtsError && e.status === 429) return true;
        console.warn(
          "[tts] Groq TTS unavailable, using the local server voice instead:",
          e instanceof Error ? e.message : e,
        );
        return false;
      }
    })();
  }
  return g.__groqTtsProbe;
}

async function resolveProvider(): Promise<Provider> {
  const p = serverTts.provider;
  if (p === "off") return null;
  if (p === "local") return serverLocalTtsAvailable ? "local" : null;
  if (p === "openrouter") {
    if (process.env.OPENROUTER_API_KEY) return "openrouter";
    return serverLocalTtsAvailable ? "local" : null;
  }
  // groq / auto: only Groq is safe to auto-enable — OpenRouter TTS models are
  // paid and would 402 on accounts without credits. Otherwise (or when Groq
  // is misconfigured) the local engine handles everything.
  if (process.env.GROQ_API_KEY && (await groqUsable())) return "groq";
  return serverLocalTtsAvailable ? "local" : null;
}

/** Kokoro voices, synthesized server-side by the local engine. */
const localVoices = tts.voices.map((v) => ({
  ...v,
  detail: `${v.detail} · server · no download`,
}));

function isKokoroVoice(voice: string): boolean {
  return tts.voices.some((v) => v.id === voice);
}

export async function GET() {
  warmLocalTts(); // load the model while the user is still editing
  const provider = await resolveProvider();
  const keyed =
    provider === "groq" || provider === "openrouter"
      ? serverVoices[provider].map((v) => ({
          ...v,
          detail: `${v.detail} · ${provider} · no download`,
        }))
      : [];
  return NextResponse.json({
    provider,
    voices: provider ? [...keyed, ...(serverLocalTtsAvailable ? localVoices : [])] : [],
  });
}

const Body = z.object({
  text: z.string().min(1).max(800),
  voice: z.string().min(1).max(60),
});

export async function POST(req: Request) {
  const provider = await resolveProvider();
  if (!provider) {
    return NextResponse.json({ error: "No server TTS configured" }, { status: 404 });
  }
  if (throttled(clientIp(req), 40)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { text, voice } = parsed.data;
  const requestId = crypto.randomUUID();

  try {
    let audioBase64: string;
    let fallback: { from: string; reason: string } | undefined;
    if (provider === "local" || isKokoroVoice(voice)) {
      // Kokoro voice ids always go to the local engine, whichever keyed
      // provider is active — its voices are offered alongside theirs.
      audioBase64 = await meteredLocalTts(text, voice, `${requestId}:local`);
    } else {
      try {
        audioBase64 = await meteredRemoteTts(provider, text, voice, `${requestId}:${provider}`);
      } catch (e) {
        // Rate limits are worth waiting out client-side (keeps the chosen
        // voice); anything else falls back to the local server voice so the
        // video always completes without the browser downloading a model.
        if (e instanceof TtsError && e.status === 429) throw e;
        const reason =
          e instanceof TtsError && e.detail ? e.detail : "upstream TTS provider failed";
        if (!serverLocalTtsAvailable) throw e;
        console.error(`[tts] ${provider} failed, using local voice:`, reason);
        audioBase64 = await meteredLocalTts(text, voice, `${requestId}:fallback-local`);
        fallback = { from: provider, reason };
      }
    }
    if (!audioBase64) {
      return NextResponse.json({ error: "TTS returned no audio" }, { status: 502 });
    }
    return NextResponse.json({ audioBase64, format: "wav", ...(fallback && { fallback }) });
  } catch (e) {
    if (e instanceof QuotaError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    const status = e instanceof TtsError ? e.status : 502;
    const detail = e instanceof TtsError ? e.detail : "";
    console.error(`[tts] ${provider} failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: detail ? `TTS failed: ${detail}` : "TTS failed" },
      { status },
    );
  }
}

function wavDurationSeconds(audioBase64: string): number | null {
  try {
    const wav = Buffer.from(audioBase64, "base64");
    if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF") return null;
    const byteRate = wav.readUInt32LE(28);
    let offset = 12;
    while (offset + 8 <= wav.length) {
      const chunk = wav.toString("ascii", offset, offset + 4);
      const size = wav.readUInt32LE(offset + 4);
      if (chunk === "data" && byteRate > 0) return size / byteRate;
      offset += 8 + size + (size % 2);
    }
  } catch {
    return null;
  }
  return null;
}

async function meteredLocalTts(text: string, voice: string, requestId: string) {
  const reservation = await reserveUsage("tts", "local", "kokoro-82m", 0, requestId);
  try {
    const audio = await localTts(text, voice);
    await finalizeUsage(reservation, "succeeded", {
      characters: text.length,
      audioSeconds: wavDurationSeconds(audio),
      metadata: { voice },
    });
    return audio;
  } catch (error) {
    await finalizeUsage(reservation, "failed", {
      characters: text.length,
      errorCode: error instanceof Error ? error.name : "tts_error",
      metadata: { voice },
    });
    throw error;
  }
}

async function meteredRemoteTts(
  provider: Exclude<Provider, "local" | null>,
  text: string,
  voice: string,
  requestId: string,
) {
  const model = provider === "groq" ? serverTts.groqModel : serverTts.openrouterModel;
  const reservation = await reserveUsage("tts", provider, model, 0, requestId);
  try {
    const audio = provider === "groq" ? await groqTts(text, voice) : await openrouterTts(text, voice);
    await finalizeUsage(reservation, "succeeded", {
      characters: text.length,
      audioSeconds: wavDurationSeconds(audio),
      metadata: { voice },
    });
    return audio;
  } catch (error) {
    await finalizeUsage(reservation, "failed", {
      characters: text.length,
      errorCode: error instanceof TtsError ? String(error.status) : "tts_error",
      metadata: { voice },
    });
    throw error;
  }
}

class TtsError extends Error {
  constructor(
    public status: number,
    public detail = "",
  ) {
    super(`TTS upstream error ${status}${detail ? `: ${detail}` : ""}`);
  }
}

/** Pulls the human-readable message out of an OpenAI-style error body. */
async function upstreamDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const msg: string | undefined = body?.error?.message;
    if (body?.error?.code === "model_terms_required") {
      return "the Groq TTS model needs a one-time terms acceptance — open console.groq.com, load the model in the playground, and accept the terms.";
    }
    return msg ?? "";
  } catch {
    return "";
  }
}

async function groqTts(text: string, voice: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({
      model: serverTts.groqModel,
      voice,
      input: text,
      response_format: "wav",
    }),
  });
  if (!res.ok) {
    throw new TtsError(res.status === 429 ? 429 : 502, await upstreamDetail(res));
  }
  return Buffer.from(await res.arrayBuffer()).toString("base64");
}

async function openrouterTts(text: string, voice: string): Promise<string> {
  const res = await fetch(`${models.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: serverTts.openrouterModel,
      modalities: ["text", "audio"],
      audio: { voice, format: "wav" },
      messages: [
        {
          role: "system",
          content:
            "You are a text-to-speech engine. Speak the user's message verbatim in a warm, natural narrator voice. Do not add, omit, or comment on anything.",
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) {
    throw new TtsError(res.status === 429 ? 429 : 502, await upstreamDetail(res));
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.audio?.data ?? "";
}
