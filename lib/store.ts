"use client";

import { create } from "zustand";
import type { Asset, MusicSettings, ProjectState, RenderState, Scene, TitleCards } from "./types";
import type { FormatId, StyleId } from "@/config/templates";
import { tts } from "@/config/models";
import { scheduleDraftSave } from "./draft";

interface Actions {
  addAssets: (assets: Asset[]) => void;
  removeAsset: (id: string) => void;
  moveAsset: (id: string, dir: -1 | 1) => void;
  patchAsset: (id: string, patch: Partial<Asset>) => void;
  setFormat: (f: FormatId) => void;
  setStyle: (s: StyleId) => void;
  setContext: (c: string) => void;
  setScenes: (scenes: Scene[]) => void;
  setCards: (patch: Partial<TitleCards>) => void;
  patchScene: (assetId: string, patch: Partial<Scene>) => void;
  setScriptStatus: (s: ProjectState["scriptStatus"]) => void;
  setVoice: (v: string) => void;
  setMusic: (patch: Partial<MusicSettings>) => void;
  setRender: (patch: Partial<RenderState>) => void;
  hydrate: (state: Partial<ProjectState>) => void;
  reset: () => void;
}

const initial: ProjectState = {
  assets: [],
  format: "9:16",
  style: "realestate",
  context: "",
  scenes: [],
  cards: { title: "", subtitle: "", outro: "", outroSub: "" },
  scriptStatus: "empty",
  voice: tts.voices[0].id,
  music: { mode: "ambient", volume: 0.14, mood: "ambient" },
  render: { status: "idle", progress: 0, label: "" },
};

export const useProject = create<ProjectState & Actions>((set) => {
  /** Wraps set() so every meaningful change schedules a draft save. */
  const update = (fn: (s: ProjectState & Actions) => Partial<ProjectState>) =>
    set((s) => {
      const next = fn(s);
      scheduleDraftSave();
      return next;
    });

  return {
    ...initial,

    addAssets: (assets) =>
      update((s) => ({ assets: [...s.assets, ...assets] })),

    removeAsset: (id) =>
      update((s) => ({
        assets: s.assets.filter((a) => a.id !== id),
        scenes: s.scenes.filter((sc) => sc.assetId !== id),
      })),

    moveAsset: (id, dir) =>
      update((s) => {
        const i = s.assets.findIndex((a) => a.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= s.assets.length) return {};
        const assets = [...s.assets];
        [assets[i], assets[j]] = [assets[j], assets[i]];
        return { assets };
      }),

    patchAsset: (id, patch) =>
      update((s) => ({
        assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })),

    setFormat: (format) => update(() => ({ format })),
    setStyle: (style) => update(() => ({ style })),
    setContext: (context) => update(() => ({ context })),

    setScenes: (scenes) => update(() => ({ scenes })),

    setCards: (patch) => update((s) => ({ cards: { ...s.cards, ...patch } })),

    patchScene: (assetId, patch) =>
      update((s) => ({
        scenes: s.scenes.map((sc) =>
          sc.assetId === assetId ? { ...sc, ...patch } : sc,
        ),
      })),

    setScriptStatus: (scriptStatus) => update(() => ({ scriptStatus })),
    setVoice: (voice) => update(() => ({ voice })),
    setMusic: (patch) => update((s) => ({ music: { ...s.music, ...patch } })),

    setRender: (patch) =>
      set((s) => ({ render: { ...s.render, ...patch } })),

    hydrate: (state) => set(() => ({ ...state })),

    reset: () => {
      set(() => ({ ...initial, render: { ...initial.render } }));
      scheduleDraftSave();
    },
  };
});
