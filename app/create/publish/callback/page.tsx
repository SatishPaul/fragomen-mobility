"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PublishCallbackPage() {
  const [message, setMessage] = useState("Finishing the account connection…");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const error = parameters.get("error") || parameters.get("error_description");
    async function completeConnection() {
      let completionError = error;
      try {
        if (!completionError) {
          const response = await fetch("/api/publish/accounts/complete", { method: "POST" });
          const body = await response.json().catch(() => null) as { accounts?: Array<{ network: string; username: string }>; error?: string } | null;
          if (!response.ok) completionError = body?.error || "The connected account could not be assigned.";
          else {
            const accountNames = body?.accounts?.map((account) => `${account.network} (${account.username})`).join(", ");
            setMessage(`Connected ${accountNames || "social account"}. It is now available after refresh.`);
          }
        }
      } catch {
        completionError = "The connection service could not be reached. Try again.";
      }
      if (completionError) setMessage(`The account was not connected: ${completionError}`);
      if (window.opener) {
        window.opener.postMessage({ type: "outstand-oauth-return", error: completionError }, window.location.origin);
        window.setTimeout(() => window.close(), 1800);
      }
    }
    void completeConnection();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-xl border border-edge bg-raised/60 p-6">
        <h1 className="font-serif text-2xl font-semibold text-heading">Social account connection</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{message}</p>
        <Link href="/create" className="mt-6 inline-flex rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg">
          Return to video
        </Link>
      </section>
    </main>
  );
}