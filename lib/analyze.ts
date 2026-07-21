"use client";

import { extractAnalysisFrames, imageToAnalysisFrame } from "./media";
import { useProject } from "./store";
import type { Asset } from "./types";

/**
 * Client half of the AI pipeline (TRD §3.3):
 *  - analysis requests are serialized with 1.5 s spacing to respect free-tier
 *    rate limits, with exponential backoff on 429;
 *  - a failed caption never blocks the project — the scene falls back to an
 *    editable placeholder.
 */

const SPACING_MS = 1500;
const PLACEHOLDER = "(describe this scene)";

type AiFailureCode =
  | "authentication_required"
  | "quota_exceeded"
  | "rate_limited"
  | "provider_unavailable"
  | "request_failed";

class AiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: AiFailureCode,
    message: string,
  ) {
    super(message);
  }
}

export function aiFailureMessage(status: number, code?: string): string {
  if (status === 401 || code === "authentication_required") {
    return "Your session expired. Sign in again, then retry.";
  }
  if (code === "quota_exceeded") {
    return "Your monthly AI token limit has been reached. Ask an administrator to raise it or wait until next month.";
  }
  if (status === 429 || code === "rate_limited") {
    return "The AI providers are temporarily rate-limited. Wait a minute, then retry.";
  }
  if (status >= 500 || code === "provider_unavailable") {
    return "The AI service is temporarily unavailable. Retry in a moment.";
  }
  return "The AI request could not be completed. Retry, or edit the scene text manually.";
}

export function shouldRetryAiRequest(status: number, code?: string): boolean {
  if (code === "quota_exceeded" || code === "authentication_required") return false;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function readAiFailure(res: Response): Promise<AiRequestError> {
  const body = (await res.json().catch(() => null)) as { code?: string } | null;
  const code = (body?.code ?? "request_failed") as AiFailureCode;
  return new AiRequestError(res.status, code, aiFailureMessage(res.status, code));
}

async function requestCaption(imageBase64: string): Promise<string> {
  let delay = 2000;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });
    if (res.ok) {
      const { caption } = (await res.json()) as { caption: string };
      return caption;
    }
    const failure = await readAiFailure(res);
    if (shouldRetryAiRequest(failure.status, failure.code) && attempt < 3) {
      await sleep(delay);
      delay *= 2;
      continue;
    }
    throw failure;
  }
  throw new Error("Analysis failed after retries");
}

async function captionAsset(asset: Asset): Promise<string> {
  if (asset.kind === "image") {
    return requestCaption(await imageToAnalysisFrame(asset.blob));
  }
  // Video: caption two frames and merge (second call keeps the same spacing).
  const frames = await extractAnalysisFrames(asset.blob, asset.duration ?? 0);
  const captions: string[] = [];
  for (const frame of frames) {
    captions.push(await requestCaption(frame));
    await sleep(SPACING_MS);
  }
  return captions.join(" Later in the clip: ");
}

/** Analyzes every un-captioned asset, one at a time. Never throws. */
export async function analyzeAssets(): Promise<{ failed: number; error?: string }> {
  const { patchAsset } = useProject.getState();
  let failed = 0;
  let lastError: string | undefined;
  for (const asset of useProject.getState().assets) {
    if (asset.caption || asset.analysis === "done") continue;
    patchAsset(asset.id, { analysis: "analyzing" });
    try {
      const caption = await captionAsset(asset);
      patchAsset(asset.id, { caption, analysis: "done" });
    } catch (error) {
      patchAsset(asset.id, { analysis: "error" });
      failed += 1;
      lastError = error instanceof Error ? error.message : aiFailureMessage(500);
    }
    await sleep(SPACING_MS);
  }
  return { failed, error: lastError };
}

/** Asks the LLM for a coherent per-scene script; falls back per-scene. */
export async function generateScript(): Promise<string | null> {
  const state = useProject.getState();
  state.setScriptStatus("generating");

  const sceneInputs = state.assets.map((a) => ({
    id: a.id,
    caption: a.caption ?? "",
    kind: a.kind,
  }));

  try {
    const res = await fetch("/api/script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scenes: sceneInputs,
        context: state.context,
        tone: (await import("@/config/templates")).styles.find(
          (s) => s.id === state.style,
        )!.tone,
        maxSeconds: (await import("@/config/templates")).limits.maxOutputSeconds,
      }),
    });
    if (!res.ok) throw await readAiFailure(res);
    const { lines, title, subtitle, outro, outroSub } = (await res.json()) as {
      lines: { id: string; text: string }[];
      title?: string;
      subtitle?: string;
      outro?: string;
      outroSub?: string;
    };
    const byId = new Map(lines.map((l) => [l.id, l.text]));
    state.setScenes(
      state.assets.map((a) => ({
        assetId: a.id,
        line: byId.get(a.id)?.trim() || a.caption || PLACEHOLDER,
      })),
    );
    state.setCards({
      title: title ?? "",
      subtitle: subtitle ?? "",
      outro: outro ?? "",
      outroSub: outroSub ?? "",
    });
    state.setScriptStatus("ready");
    return null;
  } catch (error) {
    // Fall back to captions so the user can still edit and continue — but
    // keep status "error" so the UI says these are raw descriptions, not
    // finished narration.
    state.setScenes(
      state.assets.map((a) => ({ assetId: a.id, line: a.caption || PLACEHOLDER })),
    );
    state.setScriptStatus("error");
    return error instanceof Error ? error.message : aiFailureMessage(500);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
