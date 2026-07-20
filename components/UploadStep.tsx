"use client";

import { useRef, useState } from "react";
import { limits } from "@/config/templates";
import { fileToAsset, validateFiles, type RejectedFile } from "@/lib/media";
import { useProject } from "@/lib/store";

export function UploadStep() {
  const { assets, addAssets, removeAsset, moveAsset } = useProject();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<RejectedFile[]>([]);

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const { ok, rejected } = validateFiles(files, assets.length);
    const failed: RejectedFile[] = [...rejected];
    setBusy(true);
    const prepared = [];
    for (const file of ok) {
      try {
        prepared.push(await fileToAsset(file));
      } catch (e) {
        failed.push({ name: file.name, reason: e instanceof Error ? e.message : "Could not read file" });
      }
    }
    if (prepared.length) addAssets(prepared);
    setErrors(failed);
    setBusy(false);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
          dragging ? "border-accent bg-accent/5" : "border-edge hover:border-muted"
        }`}
      >
        <svg className="h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm text-body">
          {busy ? "Reading files…" : "Drag and drop photos or clips here, or tap to browse"}
        </p>
        <p className="text-xs text-muted">
          JPG · PNG · MP4 · MOV — up to {limits.maxAssets} assets, images ≤ 15 MB, clips ≤ 60 s / 200 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {errors.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">
          {errors.map((e) => (
            <p key={e.name}>
              <span className="font-medium">{e.name}</span> — {e.reason}
            </p>
          ))}
        </div>
      )}

      {assets.length > 0 && (
        <>
          <p className="mt-5 text-xs text-muted">
            Scenes play in this order — use the arrows to rearrange.
          </p>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset, i) => (
              <li
                key={asset.id}
                className="group relative overflow-hidden rounded-xl border border-edge bg-raised"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.thumb} alt={asset.name} className="aspect-square w-full object-cover" />
                <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                {asset.kind === "video" && (
                  <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                    ▶ {Math.round(asset.duration ?? 0)}s
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent p-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                  <div className="flex gap-1">
                    <TileButton label="Move earlier" onClick={() => moveAsset(asset.id, -1)} disabled={i === 0}>
                      ←
                    </TileButton>
                    <TileButton
                      label="Move later"
                      onClick={() => moveAsset(asset.id, 1)}
                      disabled={i === assets.length - 1}
                    >
                      →
                    </TileButton>
                  </div>
                  <TileButton label="Remove" onClick={() => removeAsset(asset.id)} danger>
                    ✕
                  </TileButton>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TileButton({
  children,
  label,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold text-white transition disabled:opacity-30 ${
        danger ? "bg-red-600/80 hover:bg-red-500" : "bg-white/15 hover:bg-white/30"
      }`}
    >
      {children}
    </button>
  );
}
