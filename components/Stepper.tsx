"use client";

export interface StepperItem {
  label: string;
  state: "done" | "current" | "todo";
}

/** Chevron workflow strip, as in the reference screens. */
export function Stepper({ items, next }: { items: StepperItem[]; next?: string }) {
  const done = items.filter((i) => i.state === "done").length;
  return (
    <div className="rounded-2xl border border-edge bg-surface/80 px-4 py-3.5 sm:px-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
          Workflow · {done} of {items.length} done
        </span>
        {next && (
          <span className="text-xs text-muted">
            Next: <span className="font-semibold text-heading">{next}</span>
          </span>
        )}
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`chevron flex shrink-0 items-center gap-2 py-2 pl-5 pr-6 text-sm ${
              item.state === "done"
                ? "bg-emerald-900/50 text-emerald-300"
                : item.state === "current"
                  ? "bg-raised text-heading"
                  : "bg-raised/40 text-muted"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                item.state === "done"
                  ? "bg-emerald-400 text-emerald-950"
                  : item.state === "current"
                    ? "bg-accent text-accent-fg"
                    : "bg-edge text-muted"
              }`}
            >
              {item.state === "done" ? "✓" : i + 1}
            </span>
            <span className="whitespace-nowrap font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
