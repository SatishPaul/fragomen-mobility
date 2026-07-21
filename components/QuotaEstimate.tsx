"use client";

import { useEffect, useState } from "react";
import { quotaComparisonText } from "@/lib/usage-estimates";

type QuotaSummary = {
  used: number;
  reserved: number;
  limit: number;
  remaining: number;
};

type QuotaEstimateProps = {
  title: string;
  tokens: number;
  detail: string;
  breakdown?: string;
  approximate?: boolean;
  refreshKey?: number;
};

export function QuotaEstimate({
  title,
  tokens,
  detail,
  breakdown,
  approximate = false,
  refreshKey = 0,
}: QuotaEstimateProps) {
  const [summary, setSummary] = useState<QuotaSummary | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/usage/summary", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Quota unavailable");
        return (await response.json()) as QuotaSummary;
      })
      .then((value) => {
        if (active) setSummary(value);
      })
      .catch(() => {
        if (active) setSummary(null);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const insufficient = summary !== null && tokens > summary.remaining;
  const tokenLabel = tokens === 0
    ? "This step uses 0 quota tokens"
    : `${approximate ? "About " : ""}${tokens.toLocaleString()} tokens for this run`;

  return (
    <div
      className={`border-l-2 px-3 py-2 text-sm ${
        insufficient ? "border-amber-500 bg-amber-950/20" : "border-accent bg-raised/30"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium text-heading">{title}</p>
        <p className={insufficient ? "font-semibold text-amber-300" : "font-semibold text-accent"}>
          {tokenLabel}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
      {breakdown && <p className="mt-1 text-xs text-muted">{breakdown}</p>}
      {summary && (
        <p className={`mt-1 text-xs ${insufficient ? "text-amber-300" : "text-muted"}`}>
          {quotaComparisonText(tokens, summary)}
        </p>
      )}
    </div>
  );
}