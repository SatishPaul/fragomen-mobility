"use client";

import { useState } from "react";
import { formats, limits } from "@/config/templates";
import { isMobile } from "@/lib/media";
import { renderVideo } from "@/lib/render";
import { useProject } from "@/lib/store";

export function RenderStep() {
  const project = useProject();
  const { render, setRender, setFormat } = project;
  const [mobile] = useState(isMobile);

  async function start() {
    // Read fresh state so "re-render in another format" picks up the format
    // set a moment earlier in the same click.
    const s = useProject.getState();
    setRender({ status: "rendering", progress: 0, label: "Starting…", url: undefined, error: undefined });
    try {
      const out = await renderVideo({
        assets: s.assets,
        scenes: s.scenes,
        format: s.format,
        style: s.style,
        music: s.music,
        cards: s.cards,
        onProgress: (progress, label) => setRender({ progress, label }),
      });
      setRender({
        status: "done",
        progress: 1,
        label: `Done — ${out.width}×${out.height}, ~${out.seconds}s`,
        url: out.url,
        fileName: out.fileName,
      });
    } catch (e) {
      console.error("[render] failed:", e);
      setRender({
        status: "error",
        error: e instanceof Error ? e.message : "Render failed — try again on desktop Chrome.",
      });
    }
  }

  const otherFormats = formats.filter((f) => f.id !== project.format);

  return (
    <div className="space-y-5">
      {mobile && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-300">
          You&apos;re on a phone — rendering here is best-effort and capped at 720p. For full
          1080p and faster renders, use desktop Chrome.
        </p>
      )}

      {render.status !== "done" && (
        <button
          type="button"
          onClick={start}
          disabled={render.status === "rendering"}
          className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50"
        >
          {render.status === "rendering" ? "Rendering…" : "Render video"}
        </button>
      )}

      {render.status === "rendering" && (
        <div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-raised">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${Math.round(render.progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-muted animate-pulse-soft">{render.label}</p>
          <p className="mt-1 text-xs text-muted/70">
            Everything renders on your device — keep this tab open. A 60–90s video can take a
            few minutes.
          </p>
        </div>
      )}

      {render.status === "error" && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
          {render.error}
        </p>
      )}

      {render.status === "done" && render.url && (
        <div className="space-y-4">
          <video
            src={render.url}
            controls
            playsInline
            className="max-h-[420px] w-full rounded-xl border border-edge bg-black"
          />
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={render.url}
              download={render.fileName}
              className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:brightness-110"
            >
              ⬇ Download MP4
            </a>
            <span className="text-sm text-muted">{render.label}</span>
          </div>
          <div className="rounded-xl border border-edge bg-raised/60 p-4">
            <p className="text-sm font-medium text-heading">Post it everywhere</p>
            <p className="mt-1 text-sm text-muted">
              Your script and voiceover are kept — re-render the same video in another format in
              one click:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {otherFormats.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFormat(f.id);
                    setRender({ status: "idle", progress: 0, label: "", url: undefined });
                    start();
                  }}
                  className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-body transition hover:border-accent hover:text-heading"
                >
                  {f.label} ({f.id})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted/70">
        Output: MP4 (H.264 + AAC), up to {limits.maxOutputSeconds}s — plays on WhatsApp, YouTube
        and iOS Photos.
      </p>
    </div>
  );
}
