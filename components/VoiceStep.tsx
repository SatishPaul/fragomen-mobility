"use client";

import { useEffect, useRef, useState } from "react";
import { tts, type VoiceOption } from "@/config/models";
import { limits } from "@/config/templates";
import { musicMoods } from "@/lib/music";
import { useProject } from "@/lib/store";
import {
  clearServerTtsFallbackReason,
  generateAllVoiceovers,
  getServerTtsFallbackReason,
  getVoiceCatalog,
  playAudio,
  previewVoice,
  totalDuration,
  type TtsProgress,
} from "@/lib/tts";

const PROVIDER_LABELS: Record<string, string> = {
  local:
    "All voices are generated on the server — nothing to download, fast even on mobile connections.",
  groq: "All voices are generated on the server — nothing to download. Groq voices are limited to ten lines per minute on the free tier, so long videos pause between scenes; the server voices below them are unlimited.",
  openrouter:
    "All voices are generated on the server — nothing to download. OpenRouter voices (gpt-audio) are billed to your OpenRouter credits; the server voices below them are free and unlimited.",
  kokoro:
    "Server TTS is off, so the voice runs entirely in your browser (Kokoro, open-source). First use downloads the model once (~80 MB); after that it loads instantly.",
};

export function VoiceStep() {
  const { voice, scenes, music, setVoice, setMusic, patchScene } = useProject();
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [error, setError] = useState("");
  const [fallbackNote, setFallbackNote] = useState("");
  const [playingMusic, setPlayingMusic] = useState<string | null>(null);
  const musicStopRef = useRef<(() => void) | null>(null);
  const [projected, setProjected] = useState(0);
  const [voices, setVoices] = useState<VoiceOption[]>([...tts.voices]);
  const [provider, setProvider] = useState("kokoro");
  const stopRef = useRef<(() => void) | null>(null);

  const ready = scenes.length > 0 && scenes.every((s) => !s.line.trim() || s.audioDuration !== undefined);
  const overLimit = projected > limits.maxOutputSeconds;

  useEffect(() => {
    setProjected(totalDuration());
  }, [scenes]);

  useEffect(() => {
    let alive = true;
    getVoiceCatalog().then((catalog) => {
      if (!alive) return;
      setVoices(catalog.voices);
      setProvider(catalog.provider);
      // Make sure the selected voice belongs to the active provider.
      const state = useProject.getState();
      if (!catalog.voices.some((v) => v.id === state.voice)) {
        state.setVoice(catalog.voices[0].id);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  function describeTts(p?: TtsProgress) {
    if (p?.status === "downloading") {
      return `Downloading the voice model (one-time, ~80 MB)… ${Math.round(p.pct)}%`;
    }
    return null;
  }

  async function preview(id: string) {
    stopRef.current?.();
    setPreviewing(id);
    setError("");
    try {
      const { data, sampleRate } = await previewVoice(id, (p) => {
        const text = describeTts(p);
        if (text) setProgressText(text);
      });
      setProgressText("");
      stopRef.current = playAudio(data, sampleRate);
    } catch {
      setError("Voice preview failed. Check your connection and try again.");
    } finally {
      setPreviewing(null);
    }
  }

  async function generateAll() {
    setGenerating(true);
    setError("");
    setFallbackNote("");
    clearServerTtsFallbackReason();
    try {
      await generateAllVoiceovers((done, total, p) => {
        setProgressText(
          describeTts(p) ?? `Narrating scene ${Math.min(done + 1, total)} of ${total}…`,
        );
      });
      setProjected(totalDuration());
      setProgressText("");
      const reason = getServerTtsFallbackReason();
      if (reason) {
        setFallbackNote(
          `The selected voice was unavailable (${reason}) — a fallback voice was used, so the narration may sound different than expected.`,
        );
      }
    } catch {
      setError("Voiceover generation failed. Reload the page and try again — the model stays cached.");
    } finally {
      setGenerating(false);
    }
  }

  // Changing voice invalidates all generated audio durations.
  function selectVoice(id: string) {
    if (id === voice) return;
    setVoice(id);
    for (const scene of scenes) patchScene(scene.assetId, { audioDuration: undefined });
  }

  async function toggleMusicPreview(id: string) {
    musicStopRef.current?.();
    musicStopRef.current = null;
    if (playingMusic === id) {
      setPlayingMusic(null);
      return;
    }
    setPlayingMusic(id);
    try {
      const { previewMusic } = await import("@/lib/music");
      const stop = await previewMusic(id);
      musicStopRef.current = () => {
        stop();
        setPlayingMusic(null);
      };
      // Auto-clear the button state when the sample ends.
      setTimeout(() => {
        setPlayingMusic((current) => (current === id ? null : current));
      }, 8200);
    } catch {
      setPlayingMusic(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {voices.map((v) => {
          const selected = voice === v.id;
          return (
            <div
              key={v.id}
              className={`flex items-center justify-between rounded-xl border p-4 transition ${
                selected ? "border-accent bg-accent/10" : "border-edge bg-raised/60"
              }`}
            >
              <button type="button" onClick={() => selectVoice(v.id)} className="flex-1 text-left">
                <p className="font-semibold text-heading">{v.label}</p>
                <p className="text-xs text-muted">{v.detail}</p>
              </button>
              <button
                type="button"
                onClick={() => preview(v.id)}
                disabled={previewing !== null || generating}
                className="ml-3 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-body transition hover:border-accent hover:text-heading disabled:opacity-40"
              >
                {previewing === v.id ? "Loading…" : "▶ Preview"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generateAll}
          disabled={generating || scenes.length === 0}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50"
        >
          {generating ? "Generating…" : ready ? "Regenerate voiceover" : "Generate voiceover"}
        </button>
        {progressText && <span className="text-sm text-muted animate-pulse-soft">{progressText}</span>}
      </div>

      <p className="text-xs text-muted">{PROVIDER_LABELS[provider] ?? ""}</p>

      <div className="rounded-xl border border-edge bg-raised/40 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Background music
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              ["ambient", "Built-in music", "Royalty-free beds in four moods, duck under the voice"],
              ["custom", "Your own track", "Upload an MP3/WAV (e.g. an NCS download)"],
              ["none", "No music", "Voiceover only"],
            ] as const
          ).map(([mode, label, detail]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMusic({ mode })}
              className={`rounded-lg border p-3 text-left transition ${
                music.mode === mode
                  ? "border-accent bg-accent/10"
                  : "border-edge bg-raised/60 hover:border-muted"
              }`}
            >
              <p className="text-sm font-semibold text-heading">{label}</p>
              <p className="mt-0.5 text-xs text-muted">{detail}</p>
            </button>
          ))}
        </div>
        {music.mode === "ambient" && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {musicMoods.map((m) => {
              const selected = (music.mood ?? "ambient") === m.id;
              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between rounded-lg border p-3 transition ${
                    selected ? "border-accent bg-accent/10" : "border-edge bg-raised/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setMusic({ mood: m.id })}
                    className="flex-1 text-left"
                  >
                    <p className="text-sm font-semibold text-heading">{m.label}</p>
                    <p className="mt-0.5 text-xs text-muted">{m.detail}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleMusicPreview(m.id)}
                    className="ml-3 rounded-lg border border-edge px-3 py-1.5 text-xs font-medium text-body transition hover:border-accent hover:text-heading"
                  >
                    {playingMusic === m.id ? "■ Stop" : "▶ Preview"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {music.mode === "custom" && (
          <div className="mt-3">
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const { setCustomTrack } = await import("@/lib/music");
                  setCustomTrack(file);
                  setMusic({ trackName: file.name });
                }
                e.target.value = "";
              }}
              className="block w-full text-xs text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent-fg"
            />
            <p className="mt-1.5 flex items-center gap-2 text-xs text-muted">
              {music.trackName ? (
                <>
                  Loaded: {music.trackName}
                  <button
                    type="button"
                    onClick={() => toggleMusicPreview("custom")}
                    className="rounded border border-edge px-2 py-0.5 font-medium text-body transition hover:border-accent hover:text-heading"
                  >
                    {playingMusic === "custom" ? "■ Stop" : "▶ Preview"}
                  </button>
                </>
              ) : (
                "Pick a music file — it loops and fades automatically. Check the track's license (NCS requires attribution)."
              )}
            </p>
          </div>
        )}
        {music.mode !== "none" && (
          <label className="mt-3 flex items-center gap-3 text-xs text-muted">
            Volume
            <input
              type="range"
              min={4}
              max={30}
              value={Math.round(music.volume * 100)}
              onChange={(e) => setMusic({ volume: Number(e.target.value) / 100 })}
              className="w-40 accent-[var(--brand-accent)]"
            />
            {Math.round(music.volume * 100)}%
          </label>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {fallbackNote && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-300">
          {fallbackNote}
        </p>
      )}

      {ready && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            overLimit
              ? "border-amber-900/60 bg-amber-950/30 text-amber-300"
              : "border-emerald-900/60 bg-emerald-950/30 text-emerald-300"
          }`}
        >
          {overLimit ? (
            <>
              Voiceover ready, but the video would run ~{Math.round(projected)}s — the limit is{" "}
              {limits.maxOutputSeconds}s. Trim some narration lines or remove a few scenes.
            </>
          ) : (
            <>
              Voiceover ready — projected video length ~{Math.round(projected)}s. Scene durations
              are timed to the narration automatically.
            </>
          )}
        </div>
      )}
    </div>
  );
}
