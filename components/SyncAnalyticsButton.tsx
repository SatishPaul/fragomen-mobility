"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncAnalyticsButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sync() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/publish/posts/${encodeURIComponent(postId)}/analytics`, {
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      setError(body?.error || "Unable to refresh performance.");
      setLoading(false);
      return;
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-60"
      >
        <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        {loading ? "Refreshing" : "Refresh performance"}
      </button>
      {error && <span className="max-w-48 text-right text-xs text-red-400">{error}</span>}
    </span>
  );
}