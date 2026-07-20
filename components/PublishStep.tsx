"use client";

import { platformsForFormat } from "@/config/social-platforms";
import { getLatestRenderOutput } from "@/lib/render-output";
import { useProject } from "@/lib/store";

export function PublishStep() {
  const { format, render } = useProject();
  const platforms = platformsForFormat(format);
  const output = getLatestRenderOutput();

  if (render.status !== "done" || !output) {
    return <p className="text-sm text-muted">Render the video before choosing publishing accounts.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-edge bg-raised/60 p-4">
        <p className="text-sm font-semibold text-heading">Recommended for this {format} render</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <span
              key={platform.id}
              title={platform.note}
              className="rounded-md border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-body"
            >
              {platform.label}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-muted">
          Title
          <input
            type="text"
            disabled
            placeholder="Available after Outstand is connected"
            className="mt-2 w-full rounded-lg border border-edge bg-background px-3 py-2 text-body disabled:opacity-60"
          />
        </label>
        <label className="text-sm text-muted">
          Caption
          <input
            type="text"
            disabled
            placeholder="Available after Outstand is connected"
            className="mt-2 w-full rounded-lg border border-edge bg-background px-3 py-2 text-body disabled:opacity-60"
          />
        </label>
      </div>

      <button
        type="button"
        disabled
        className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-fg opacity-50"
      >
        Connect publishing services
      </button>
      <p className="text-xs text-muted/70">
        Publishing will upload only this finished MP4 to temporary Vercel Blob storage. Nothing
        is posted until you review the accounts and confirm Publish.
      </p>
    </div>
  );
}