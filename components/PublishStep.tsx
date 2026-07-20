"use client";

import { useEffect, useState } from "react";
import { platformsForFormat, socialPlatforms, type SocialNetwork } from "@/config/social-platforms";
import {
  allOutcomesTerminal,
  composePostContent,
  failedAccountIds,
  type PublishOutcome,
} from "@/lib/publishing";
import { getLatestRenderOutput } from "@/lib/render-output";
import { useProject } from "@/lib/store";
import type { SocialAccount } from "@/lib/types";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(body?.error ?? "The publishing service could not complete the request.");
  return body as T;
}

function putVideo(uploadUrl: string, blob: Blob, onProgress: (progress: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", "video/mp4");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error("The video upload to Outstand failed."));
    };
    request.onerror = () => reject(new Error("The browser could not upload the video to Outstand."));
    request.send(blob);
  });
}

export function PublishStep() {
  const { format, render, publish, setPublish } = useProject();
  const [connectNetwork, setConnectNetwork] = useState<SocialNetwork>("instagram");
  const [outcomes, setOutcomes] = useState<PublishOutcome[]>([]);
  const [confirmedMediaId, setConfirmedMediaId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const platforms = platformsForFormat(format);
  const output = getLatestRenderOutput();
  const busy = ["loading-accounts", "uploading", "publishing", "pending"].includes(publish.status);

  useEffect(() => {
    if (render.status !== "done") return;
    let cancelled = false;
    setPublish({ status: "loading-accounts", error: undefined });
    api<{ accounts: SocialAccount[] }>("/api/publish/accounts")
      .then(({ accounts }) => {
        if (!cancelled) setPublish({ status: "ready", accounts });
      })
      .catch((error: unknown) => {
        if (!cancelled) setPublish({
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load connected accounts.",
        });
      });
    return () => { cancelled = true; };
  }, [refreshKey, render.status, setPublish]);

  useEffect(() => {
    function handleOAuthReturn(event: MessageEvent) {
      if (event.origin === window.location.origin && event.data?.type === "outstand-oauth-return") {
        setRefreshKey((key) => key + 1);
      }
    }
    window.addEventListener("message", handleOAuthReturn);
    return () => window.removeEventListener("message", handleOAuthReturn);
  }, []);

  function toggleAccount(id: string) {
    const selectedAccountIds = publish.selectedAccountIds.includes(id)
      ? publish.selectedAccountIds.filter((accountId) => accountId !== id)
      : [...publish.selectedAccountIds, id];
    setPublish({ selectedAccountIds, error: undefined });
  }

  async function connectAccount() {
    const popup = window.open("", "outstand-oauth", "width=720,height=800");
    if (!popup) {
      setPublish({ error: "Allow popups to connect a social account." });
      return;
    }
    try {
      const { url } = await api<{ url: string }>("/api/publish/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network: connectNetwork }),
      });
      popup.location.href = url;
    } catch (error) {
      popup.close();
      setPublish({ error: error instanceof Error ? error.message : "Unable to connect the account." });
    }
  }

  async function pollPost(postId: string): Promise<void> {
    setActivePostId(postId);
    for (let attempt = 0; attempt < 90; attempt += 1) {
      const result = await api<{ accounts: PublishOutcome[] }>(`/api/publish/posts/${postId}`);
      setOutcomes(result.accounts);
      if (allOutcomesTerminal(result.accounts)) {
        setActivePostId(null);
        setPublish({ status: "complete" });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setPublish({ status: "ready", error: "Publishing is still processing. Resume status monitoring shortly." });
  }

  async function submitPost(accountIds: string[], mediaId: string): Promise<void> {
    const content = composePostContent(publish.title, publish.caption);
    const post = await api<{ id: string }>("/api/publish/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountIds, content, mediaId }),
    });
    setPublish({ status: "pending", error: undefined });
    await pollPost(post.id);
  }

  async function retryFailedAccounts() {
    if (!confirmedMediaId) return;
    const retryAccountIds = failedAccountIds(outcomes);
    if (retryAccountIds.length === 0) return;
    try {
      setPublish({ status: "publishing", error: undefined });
      await submitPost(retryAccountIds, confirmedMediaId);
    } catch (error) {
      setPublish({ status: "error", error: error instanceof Error ? error.message : "Retry failed." });
    }
  }

  async function publishVideo() {
    if (!output) return;
    const selected = publish.accounts.filter((account) => publish.selectedAccountIds.includes(account.id));
    if (selected.length === 0) {
      setPublish({ error: "Choose at least one connected account." });
      return;
    }
    if (!publish.caption.trim()) {
      setPublish({ error: "Add a caption before publishing." });
      return;
    }
    const needsTitle = selected.some((account) =>
      socialPlatforms.some((platform) => platform.id === account.network && platform.requiresTitle));
    if (needsTitle && !publish.title.trim()) {
      setPublish({ error: "Add a title for the selected video platform." });
      return;
    }
    const content = composePostContent(publish.title, publish.caption);
    if (content.length > 5000) {
      setPublish({ error: "The combined title and caption must not exceed 5,000 characters." });
      return;
    }

    const targetNames = selected.map((account) => `${account.nickname} (${account.username})`).join("\n");
    const confirmed = window.confirm(
      `Publish this finished video to:\n\n${targetNames}\n\nThe video will be uploaded to Outstand and sent to these social platforms.`,
    );
    if (!confirmed) return;

    try {
      setOutcomes([]);
      setPublish({ status: "uploading", uploadProgress: 0, error: undefined });
      const media = await api<{ id: string; uploadUrl: string }>("/api/publish/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: output.fileName }),
      });
      await putVideo(media.uploadUrl, output.blob, (uploadProgress) => setPublish({ uploadProgress }));
      await api("/api/publish/media/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: media.id, size: output.blob.size }),
      });
      setConfirmedMediaId(media.id);

      setPublish({ status: "publishing", uploadProgress: 1 });
      await submitPost(selected.map((account) => account.id), media.id);
    } catch (error) {
      setPublish({ status: "error", error: error instanceof Error ? error.message : "Publishing failed." });
    }
  }

  if (render.status !== "done" || !output) {
    return <p className="text-sm text-muted">Render the video before choosing publishing accounts.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-edge bg-raised/60 p-4">
        <p className="text-sm font-semibold text-heading">Recommended for this {format} render</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {platforms.map((platform) => (
            <span key={platform.id} title={platform.note} className="rounded-md border border-edge bg-surface px-3 py-1.5 text-xs font-medium text-body">
              {platform.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 text-sm text-muted">
          Connect or change account
          <select value={connectNetwork} onChange={(event) => setConnectNetwork(event.target.value as SocialNetwork)} className="mt-2 w-full rounded-lg border border-edge bg-background px-3 py-2 text-body">
            {socialPlatforms.filter((platform) => platform.publishingEnabled !== false).map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}
          </select>
        </label>
        <button type="button" onClick={connectAccount} disabled={busy} className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-body transition hover:border-accent disabled:opacity-50">Connect account</button>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={busy} className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-body transition hover:border-accent disabled:opacity-50">Refresh</button>
      </div>

      {publish.status === "loading-accounts" && <p className="text-sm text-muted">Checking connected accounts…</p>}
      {publish.accounts.length > 0 && (
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Publishing accounts</legend>
          {publish.accounts.map((account) => (
            <label key={account.id} className={`flex items-center gap-3 rounded-lg border p-3 ${socialPlatforms.some((platform) => platform.id === account.network && platform.publishingEnabled === false) ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${publish.selectedAccountIds.includes(account.id) ? "border-accent bg-raised" : "border-edge bg-background"}`}>
              <input type="checkbox" checked={publish.selectedAccountIds.includes(account.id)} onChange={() => toggleAccount(account.id)} disabled={socialPlatforms.some((platform) => platform.id === account.network && platform.publishingEnabled === false)} className="h-4 w-4 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-heading">{account.nickname}</span>
                <span className="block truncate text-xs text-muted">{account.network} · {account.username}</span>
              </span>
              <span className={`text-xs ${account.active && account.healthy ? "text-emerald-400" : "text-amber-300"}`}>{socialPlatforms.some((platform) => platform.id === account.network && platform.publishingEnabled === false) ? "Not yet supported" : account.active && account.healthy ? "Healthy" : "Reconnect"}</span>
            </label>
          ))}
        </fieldset>
      )}
      {publish.status !== "loading-accounts" && publish.accounts.length === 0 && !publish.error && (
        <p className="rounded-lg border border-edge bg-raised/60 p-3 text-sm text-muted">No connected accounts found. Choose a network above to connect one.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-muted">Title
          <input type="text" value={publish.title} onChange={(event) => setPublish({ title: event.target.value })} disabled={busy} maxLength={200} placeholder="Required for YouTube and Vimeo" className="mt-2 w-full rounded-lg border border-edge bg-background px-3 py-2 text-body disabled:opacity-60" />
        </label>
        <label className="text-sm text-muted">Caption
          <textarea value={publish.caption} onChange={(event) => setPublish({ caption: event.target.value })} disabled={busy} maxLength={5000} rows={3} placeholder="Write the post caption" className="mt-2 w-full resize-y rounded-lg border border-edge bg-background px-3 py-2 text-body disabled:opacity-60" />
        </label>
      </div>

      {publish.status === "uploading" && (
        <div aria-live="polite">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-raised"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(publish.uploadProgress * 100)}%` }} /></div>
          <p className="mt-2 text-sm text-muted">Uploading to Outstand · {Math.round(publish.uploadProgress * 100)}%</p>
        </div>
      )}
      {(publish.status === "publishing" || publish.status === "pending") && <p aria-live="polite" className="text-sm text-muted">{publish.status === "publishing" ? "Submitting post…" : "Waiting for platform results…"}</p>}
      {outcomes.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {outcomes.map((outcome) => (
            <div key={outcome.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-edge bg-raised/60 px-3 py-2 text-sm">
              <span className="text-body">{outcome.network} · {outcome.username}</span>
              {outcome.platformPostUrl && outcome.status === "published"
                ? <a href={outcome.platformPostUrl} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">View post</a>
                : <span className={outcome.status === "failed" ? "text-red-300" : "text-muted"}>{outcome.status}{outcome.error ? ` · ${outcome.error}` : ""}</span>}
            </div>
          ))}
        </div>
      )}
      {publish.error && <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-300">{publish.error}</p>}

      <div className="flex flex-wrap gap-3">
        {outcomes.length === 0 && <button type="button" onClick={publishVideo} disabled={busy || publish.selectedAccountIds.length === 0} className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50">Review and publish</button>}
        {confirmedMediaId && outcomes.some((outcome) => outcome.status === "failed") && <button type="button" onClick={retryFailedAccounts} disabled={busy} className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50">Retry failed accounts</button>}
        {activePostId && publish.status === "ready" && <button type="button" onClick={() => pollPost(activePostId)} className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-body transition hover:border-accent">Resume status</button>}
      </div>
      <p className="text-xs text-muted/70">Nothing is uploaded or posted until you confirm the named accounts. Source media and rendering stay on this device; the finished MP4 is uploaded directly to Outstand for delivery.</p>
    </div>
  );
}