"use client";

import { CircleCheck, Link2, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { socialPlatforms, type SocialNetwork } from "@/config/social-platforms";
import type { SocialAccount } from "@/lib/types";

async function loadAccounts(): Promise<SocialAccount[]> {
  const response = await fetch("/api/publish/accounts", { cache: "no-store" });
  const body = await response.json().catch(() => null) as { accounts?: SocialAccount[]; error?: string } | null;
  if (!response.ok) throw new Error(body?.error || "Connected accounts could not be loaded.");
  return body?.accounts || [];
}

export function ConnectedAccountsPanel({ canConnect }: { canConnect: boolean }) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [network, setNetwork] = useState<SocialNetwork>("linkedin");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      setAccounts(await loadAccounts());
      setStatus("ready");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Connected accounts could not be loaded.");
      setStatus("error");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    function handleOAuthReturn(event: MessageEvent) {
      if (event.origin === window.location.origin && event.data?.type === "outstand-oauth-return") {
        void refresh();
      }
    }
    window.addEventListener("message", handleOAuthReturn);
    return () => window.removeEventListener("message", handleOAuthReturn);
  }, [refresh]);

  async function connectAccount() {
    const popup = window.open("", "outstand-oauth", "width=720,height=800");
    if (!popup) {
      setError("Allow popups to connect a social account.");
      setStatus("error");
      return;
    }
    try {
      const response = await fetch("/api/publish/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network }),
      });
      const body = await response.json().catch(() => null) as { url?: string; error?: string } | null;
      if (!response.ok || !body?.url) throw new Error(body?.error || "The account connection could not be started.");
      popup.location.href = body.url;
    } catch (connectError) {
      popup.close();
      setError(connectError instanceof Error ? connectError.message : "The account connection could not be started.");
      setStatus("error");
    }
  }

  return (
    <section className="mt-8" aria-labelledby="connected-accounts-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="connected-accounts-heading" className="font-serif text-xl text-heading">Connected social accounts</h2>
          <p className="mt-1 text-sm text-muted">Accounts available for explicit publishing confirmation.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {canConnect && <><label className="text-xs font-medium text-muted">Network<select value={network} onChange={(event) => setNetwork(event.target.value as SocialNetwork)} className="mt-1 block border border-edge bg-surface px-3 py-2 text-sm text-body">{socialPlatforms.filter((platform) => platform.publishingEnabled !== false && platform.id !== "bluesky").map((platform) => <option key={platform.id} value={platform.id}>{platform.label}</option>)}</select></label><button type="button" onClick={connectAccount} className="flex h-10 items-center gap-2 border border-edge px-3 text-sm font-medium text-body hover:border-accent"><Link2 className="h-4 w-4" aria-hidden="true" />Connect</button></>}
          <button type="button" onClick={() => void refresh()} disabled={status === "loading"} className="flex h-10 items-center gap-2 border border-edge px-3 text-sm font-medium text-body hover:border-accent disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} aria-hidden="true" />Refresh</button>
        </div>
      </div>
      {status === "loading" && accounts.length === 0 && <p className="mt-3 border border-edge bg-surface p-5 text-sm text-muted">Checking connected accounts...</p>}
      {status === "error" && <p role="alert" className="mt-3 border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-300">{error}</p>}
      {status !== "loading" && accounts.length === 0 && !error && <p className="mt-3 border border-edge bg-surface p-5 text-sm text-muted">No publishing accounts are available. {canConnect ? "Connect the first account above." : "Ask an administrator to assign an account to you."}</p>}
      {accounts.length > 0 && <div className="mt-3 grid gap-px bg-edge sm:grid-cols-2 lg:grid-cols-3">{accounts.map((account) => { const healthy = account.active && account.healthy; return <div key={account.id} className="flex min-w-0 items-center gap-3 bg-surface p-4">{healthy ? <CircleCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" /> : <TriangleAlert className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />}<div className="min-w-0 flex-1"><p className="truncate font-medium text-heading">{account.nickname}</p><p className="truncate text-xs text-muted"><span className="capitalize">{account.network.replaceAll("_", " ")}</span> · {account.username}</p></div><span className={`text-xs font-medium ${healthy ? "text-emerald-400" : "text-amber-300"}`}>{healthy ? "Ready" : "Reconnect"}</span></div>; })}</div>}
    </section>
  );
}