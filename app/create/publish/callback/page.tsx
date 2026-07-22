"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface PendingPage {
  id: string;
  type: string;
  name: string;
  username: string;
}

interface CompletionBody {
  accounts?: Array<{ network: string; username: string }>;
  pending?: { pages: PendingPage[] };
  error?: string;
}

async function submitCompletion(payload: Record<string, unknown>): Promise<{ ok: boolean; body: CompletionBody | null }> {
  const response = await fetch("/api/publish/accounts/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ok: response.ok, body: await response.json().catch(() => null) as CompletionBody | null };
}

export default function PublishCallbackPage() {
  const [message, setMessage] = useState("Finishing the account connection…");
  const [pendingPages, setPendingPages] = useState<PendingPage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [pendingSession, setPendingSession] = useState<string | null>(null);

  function finish(body: CompletionBody | null, completionError?: string) {
    if (completionError) setMessage(`The account was not connected: ${completionError}`);
    else {
      const accountNames = body?.accounts?.map((account) => `${account.network} (${account.username})`).join(", ");
      setMessage(`Connected ${accountNames || "social account"}. It is now available after refresh.`);
    }
    if (window.opener) {
      window.opener.postMessage({ type: "outstand-oauth-return", error: completionError }, window.location.origin);
      window.setTimeout(() => window.close(), 1800);
    }
  }

  async function finalizeSelection() {
    if (!pendingSession || selectedPageIds.length === 0) return;
    setMessage("Finishing the selected account connection…");
    const result = await submitCompletion({ pendingSession, selectedPageIds }).catch(() => null);
    if (!result) finish(null, "The connection service could not be reached. Try again.");
    else finish(result.body, result.ok ? undefined : result.body?.error || "The connected account could not be assigned.");
  }

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const error = parameters.get("error") || parameters.get("error_description");
    async function completeConnection() {
      let completionError = error;
      try {
        if (!completionError) {
          const session = parameters.get("session");
          const result = await submitCompletion({
            success: parameters.get("success"),
            accountId: parameters.get("account_id"),
            username: parameters.get("username"),
            pendingSession: session,
          });
          if (!result.ok) completionError = result.body?.error || "The connected account could not be assigned.";
          else if (result.body?.pending?.pages.length) {
            setPendingSession(session);
            setPendingPages(result.body.pending.pages);
            setMessage("Choose the LinkedIn profile or organization pages to connect.");
            return;
          } else {
            finish(result.body);
            return;
          }
        }
      } catch {
        completionError = "The connection service could not be reached. Try again.";
      }
      finish(null, completionError);
    }
    void completeConnection();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-xl border border-edge bg-raised/60 p-6">
        <h1 className="font-serif text-2xl font-semibold text-heading">Social account connection</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        {pendingPages.length > 0 && (
          <div className="mt-5 space-y-3">
            {pendingPages.map((page) => (
              <label key={page.id} className="flex items-center gap-3 rounded-lg border border-edge p-3 text-sm text-heading">
                <input
                  type="checkbox"
                  checked={selectedPageIds.includes(page.id)}
                  onChange={(event) => setSelectedPageIds((current) => event.target.checked
                    ? [...current, page.id]
                    : current.filter((id) => id !== page.id))}
                />
                <span>{page.name} <span className="text-muted">({page.type})</span></span>
              </label>
            ))}
            <button
              type="button"
              disabled={selectedPageIds.length === 0}
              onClick={() => void finalizeSelection()}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
            >
              Connect selected
            </button>
          </div>
        )}
        <Link href="/create" className="mt-6 inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg">
          Return to video
        </Link>
      </section>
    </main>
  );
}