"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PublishCallbackPage() {
  const [message, setMessage] = useState("Finishing the account connection…");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const error = parameters.get("error") || parameters.get("error_description");
    setMessage(error
      ? `The account was not connected: ${error}`
      : "Account connection returned successfully. Refresh connected accounts in the Publish step.");
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