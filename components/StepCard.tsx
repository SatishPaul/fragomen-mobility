import type { ReactNode } from "react";

export type StepStatus = "locked" | "active" | "done";

/**
 * Numbered section card with a colored left rail — the core layout unit of
 * the wizard, mirroring the reference screens.
 */
export function StepCard({
  number,
  title,
  subtitle,
  color,
  status,
  aside,
  children,
}: {
  number: number;
  title: string;
  subtitle: string;
  /** Left-rail + badge color, e.g. "#c084fc". */
  color: string;
  status: StepStatus;
  /** Small right-aligned note, e.g. "3 uploaded". */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  const locked = status === "locked";
  return (
    <section
      id={`step-${number}`}
      className={`relative overflow-hidden rounded-2xl border border-edge bg-surface/80 transition ${
        locked ? "opacity-45" : ""
      }`}
      style={{ borderLeft: `3px solid ${locked ? "var(--brand-border)" : color}` }}
    >
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{
                background: status === "done" ? "var(--brand-success)" : color,
                color: "#0a0f1e",
              }}
            >
              {status === "done" ? "✓" : number}
            </span>
            <div>
              <h2 className="font-serif text-xl font-semibold text-heading sm:text-2xl">
                {title}
              </h2>
            </div>
          </div>
          {aside && <div className="pt-1 text-sm text-muted">{aside}</div>}
        </div>
        <p className="mt-2 text-sm text-muted sm:ml-11">{subtitle}</p>
        {!locked && <div className="mt-5 sm:ml-11">{children}</div>}
        {locked && (
          <p className="mt-4 text-sm italic text-muted/70 sm:ml-11">
            Complete the previous step to unlock.
          </p>
        )}
      </div>
    </section>
  );
}
