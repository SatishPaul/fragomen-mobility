"use client";

import { formats, styles } from "@/config/templates";
import { useProject } from "@/lib/store";

export function FormatStep() {
  const { format, style, setFormat, setStyle } = useProject();

  return (
    <div className="space-y-7">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Output format
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {formats.map((f) => {
            const selected = format === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFormat(f.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-edge bg-raised/60 hover:border-muted"
                }`}
              >
                <div className="mb-3 flex h-14 items-center">
                  <div
                    className={`rounded border-2 ${selected ? "border-accent" : "border-muted"}`}
                    style={{
                      width: f.id === "9:16" ? 32 : f.id === "1:1" ? 44 : 56,
                      height: f.id === "9:16" ? 56 : f.id === "1:1" ? 44 : 32,
                    }}
                  />
                </div>
                <p className="font-semibold text-heading">{f.label}</p>
                <p className="mt-0.5 text-xs text-muted">{f.detail}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
          Style template
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {styles.map((s) => {
            const selected = style === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-edge bg-raised/60 hover:border-muted"
                }`}
              >
                <div
                  className="mb-3 h-2 w-16 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${s.swatch[0]}, ${s.swatch[1]})` }}
                />
                <p className="font-semibold text-heading">{s.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.detail}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
