"use client";

import { get, set, del } from "idb-keyval";
import type { Asset, MusicSettings, ProjectState, Scene, TitleCards } from "./types";

/**
 * Draft persistence (TRD: Zustand in-memory + IndexedDB draft recovery).
 * Media blobs are stored in IndexedDB so a closed tab doesn't lose the
 * project. Generated audio and render output are intentionally not persisted.
 */

const KEY = "videomaker-draft-v1";

interface DraftAsset {
  id: string;
  kind: Asset["kind"];
  name: string;
  blob: Blob;
  thumb: string;
  duration?: number;
  caption?: string;
}

interface Draft {
  assets: DraftAsset[];
  format: ProjectState["format"];
  style: ProjectState["style"];
  context: string;
  scenes: Pick<Scene, "assetId" | "line">[];
  cards?: TitleCards;
  voice: string;
  music?: MusicSettings;
  savedAt: number;
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Debounced save — called by the store on every meaningful change. */
export function scheduleDraftSave() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(saveDraft, 800);
}

async function saveDraft() {
  const { useProject } = await import("./store");
  const s = useProject.getState();
  if (s.assets.length === 0 && !s.context) {
    await del(KEY).catch(() => {});
    return;
  }
  const draft: Draft = {
    assets: s.assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      blob: a.blob,
      thumb: a.thumb,
      duration: a.duration,
      caption: a.caption,
    })),
    format: s.format,
    style: s.style,
    context: s.context,
    scenes: s.scenes.map((sc) => ({ assetId: sc.assetId, line: sc.line })),
    cards: s.cards,
    voice: s.voice,
    // Custom-uploaded music files aren't persisted; fall back to ambient.
    music: s.music.mode === "custom" ? { mode: "ambient", volume: s.music.volume } : s.music,
    savedAt: Date.now(),
  };
  try {
    await set(KEY, draft);
  } catch {
    // Quota exceeded or private browsing — drafts are best-effort.
  }
}

/** Loads a saved draft into the store. Returns true if one existed. */
export async function restoreDraft(): Promise<boolean> {
  const { useProject } = await import("./store");
  let draft: Draft | undefined;
  try {
    draft = await get<Draft>(KEY);
  } catch {
    return false;
  }
  if (!draft || draft.assets.length === 0) return false;

  useProject.getState().hydrate({
    assets: draft.assets.map((a) => ({
      ...a,
      analysis: a.caption ? "done" : "pending",
    })),
    format: draft.format,
    style: draft.style,
    context: draft.context,
    scenes: draft.scenes,
    scriptStatus: draft.scenes.length > 0 ? "ready" : "empty",
    voice: draft.voice,
    ...(draft.cards ? { cards: draft.cards } : {}),
    ...(draft.music ? { music: draft.music } : {}),
  });
  return true;
}

export async function clearDraft() {
  await del(KEY).catch(() => {});
}
