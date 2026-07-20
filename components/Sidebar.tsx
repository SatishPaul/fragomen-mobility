"use client";

import { formats, styles } from "@/config/templates";
import { useProject } from "@/lib/store";

/** Sticky project summary panel, echoing the reference layout's side card. */
export function Sidebar({ projectedSeconds }: { projectedSeconds: number }) {
  const { assets, format, style, scenes, voice, render, reset } = useProject();
  const images = assets.filter((a) => a.kind === "image").length;
  const videos = assets.length - images;
  const scriptReady = scenes.length > 0;
  const voReady = scriptReady && scenes.every((s) => !s.line.trim() || s.audioDuration !== undefined);

  return (
    <aside className="rounded-2xl border border-dashed border-edge bg-surface/60 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-lg font-semibold text-heading">Project</h3>
        <span className="text-xs text-muted">
          {render.status === "done" ? "Rendered" : "Draft"}
        </span>
      </div>
      <dl className="space-y-2.5 text-sm">
        <Row label="Media">
          {assets.length === 0 ? "—" : `${images} photo${images === 1 ? "" : "s"}${videos ? `, ${videos} clip${videos === 1 ? "" : "s"}` : ""}`}
        </Row>
        <Row label="Format">{formats.find((f) => f.id === format)?.label ?? format}</Row>
        <Row label="Style">{styles.find((s) => s.id === style)?.label ?? style}</Row>
        <Row label="Script">{scriptReady ? `${scenes.length} scenes` : "Not written yet"}</Row>
        <Row label="Voiceover">{voReady ? "Ready" : "Not generated"}</Row>
        <Row label="Est. length">
          {projectedSeconds > 0 ? `~${Math.round(projectedSeconds)}s` : "—"}
        </Row>
      </dl>
      <p className="mt-5 border-t border-edge/60 pt-4 text-xs leading-relaxed text-muted/80">
        Drafts auto-save in this browser. Your photos and clips never leave your device — only
        small downscaled frames are sent for AI analysis.
      </p>
      {assets.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (confirm("Start over? This clears the current project.")) reset();
          }}
          className="mt-4 text-xs font-medium text-muted underline-offset-2 transition hover:text-red-400 hover:underline"
        >
          Reset project
        </button>
      )}
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-heading">{children}</dd>
    </div>
  );
}
