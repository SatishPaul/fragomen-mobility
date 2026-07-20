"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { brand } from "@/config/brand";

export default function GatePage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setBusy(false);
    if (res.ok) router.push("/");
    else setError("That password is not right.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-8"
      >
        <Image src={brand.logo} alt={brand.name} width={160} height={43} className="mb-6" />
        <h1 className="font-serif text-2xl text-heading">Private preview</h1>
        <p className="mt-1 text-sm text-muted">Enter the shared password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-5 w-full rounded-lg border border-edge bg-raised px-3 py-2.5 text-heading outline-none focus:border-accent"
          placeholder="Password"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-fg transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
