"use client";

import { useState } from "react";
import { analyzeAssets, generateScript } from "@/lib/analyze";
import { useProject } from "@/lib/store";

export function ScriptStep() {
  const { assets, scenes, context, cards, scriptStatus, setContext, setCards, patchScene } =
    useProject();
  const [running, setRunning] = useState(false);

  const analyzing = assets.some((a) => a.analysis === "analyzing");
  const assetById = new Map(assets.map((a) => [a.id, a]));

  async function run() {
    setRunning(true);
    try {
      await analyzeAssets();
      await generateScript();
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="context" className="mb-1.5 block text-sm font-medium text-heading">
          Tell the AI about this video <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder='e.g. "3BHK apartment in Salt Lake, highlight the balcony and the modular kitchen"'
          className="w-full resize-y rounded-lg border border-edge bg-raised px-3 py-2.5 text-sm text-heading placeholder:text-muted/60 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running || assets.length === 0}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50"
        >
          {running
            ? analyzing
              ? "Analyzing your media…"
              : "Writing the script…"
            : scenes.length > 0
              ? "Re-analyze & rewrite script"
              : "Analyze media & draft script"}
        </button>
        {running && (
          <span className="text-sm text-muted animate-pulse-soft">
            {assets.filter((a) => a.analysis === "done").length} of {assets.length} assets analyzed
          </span>
        )}
      </div>

      {scriptStatus === "error" && scenes.length === 0 && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-300">
          The AI couldn&apos;t analyze your media right now (free models are sometimes
          rate-limited). You can retry, or continue — every line below is editable by hand.
        </p>
      )}

      {scriptStatus === "error" && scenes.length > 0 && (
        <p className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-3 text-sm text-amber-300">
          The script writer couldn&apos;t run, so these lines are raw image descriptions —
          they won&apos;t sound like narration yet. Hit &ldquo;Re-analyze &amp; rewrite
          script&rdquo; to retry, or edit the lines by hand.
        </p>
      )}

      {scenes.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted">
            Edit any line — this is exactly what the voiceover will say, scene by scene.
          </p>
          <ul className="thin-scroll max-h-[26rem] space-y-2.5 overflow-y-auto pr-1">
            {scenes.map((scene, i) => {
              const asset = assetById.get(scene.assetId);
              if (!asset) return null;
              return (
                <li
                  key={scene.assetId}
                  className="flex gap-3 rounded-xl border border-edge bg-raised/60 p-3"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.thumb}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                      Scene {i + 1}
                      {asset.analysis === "error" && (
                        <span className="rounded bg-amber-900/50 px-1.5 py-0.5 normal-case text-amber-300">
                          analysis failed — write this one yourself
                        </span>
                      )}
                    </p>
                    <textarea
                      value={scene.line}
                      onChange={(e) =>
                        patchScene(scene.assetId, {
                          line: e.target.value,
                          audioDuration: undefined,
                        })
                      }
                      rows={2}
                      className="w-full resize-none rounded-md border border-transparent bg-transparent text-sm leading-relaxed text-body focus:border-accent focus:bg-surface focus:px-2 focus:py-1 focus:text-heading focus:outline-none"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {scenes.length > 0 && (
        <div className="rounded-xl border border-edge bg-raised/40 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">
            Opening &amp; closing cards
          </p>
          <p className="mb-3 text-xs text-muted">
            On-screen text for the animated title cards that bookend the video — written by
            the AI with the script, editable here. Leave the title or closing empty to skip
            that card.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["title", "Opening title", cards.title],
                ["subtitle", "Opening subtitle (shown above the title)", cards.subtitle],
                ["outro", "Closing line", cards.outro],
                ["outroSub", "Closing detail (price, contact, next step)", cards.outroSub],
              ] as const
            ).map(([key, label, value]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
                <input
                  type="text"
                  value={value}
                  maxLength={160}
                  onChange={(e) => setCards({ [key]: e.target.value })}
                  className="w-full rounded-lg border border-edge bg-raised px-3 py-2 text-sm text-heading placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
