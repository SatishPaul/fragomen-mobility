"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "forgot" | "reset";

const copy = {
  login: {
    title: "Welcome back",
    description: "Sign in to create, publish, and track your videos.",
    submit: "Sign in",
  },
  forgot: {
    title: "Reset your password",
    description: "We will email you a secure password reset link.",
    submit: "Send reset link",
  },
  reset: {
    title: "Choose a new password",
    description: "Use at least eight characters for your new password.",
    submit: "Update password",
  },
} as const;

export function AuthPanel({ mode }: { mode: AuthMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const content = copy[mode];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.replace(searchParams.get("next") || "/dashboard");
        router.refresh();
      } else if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage("Check your email for the reset link.");
      } else {
        if (password.length < 8) throw new Error("Password must be at least eight characters.");
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) throw updateError;
        setMessage("Password updated. Redirecting to your dashboard.");
        window.setTimeout(() => router.replace("/dashboard"), 800);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to complete the request.");
    } finally {
      setBusy(false);
    }
  }

  const disabledMessage = searchParams.get("error") === "disabled";

  return (
    <form onSubmit={submit} className="w-full max-w-md border border-edge bg-surface p-8 shadow-2xl shadow-black/20">
      <p className="text-xs font-semibold uppercase text-accent">VideoMaker account</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold text-heading">{content.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{content.description}</p>

      {disabledMessage && (
        <p className="mt-5 border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">
          This account is disabled. Contact an administrator.
        </p>
      )}

      {mode !== "reset" && (
        <label className="mt-6 block text-sm font-medium text-heading">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            autoFocus
            className="mt-2 w-full border border-edge bg-raised px-3 py-3 text-heading outline-none transition focus:border-accent"
          />
        </label>
      )}

      {mode !== "forgot" && (
        <label className="mt-5 block text-sm font-medium text-heading">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            autoFocus={mode === "reset"}
            className="mt-2 w-full border border-edge bg-raised px-3 py-3 text-heading outline-none transition focus:border-accent"
          />
        </label>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      {message && <p role="status" className="mt-4 text-sm text-success">{message}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-6 w-full bg-accent px-4 py-3 font-semibold text-accent-fg transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "Working..." : content.submit}
      </button>

      <div className="mt-5 flex justify-between text-sm text-muted">
        {mode === "login" ? (
          <Link href="/forgot-password" className="hover:text-heading">Forgot password?</Link>
        ) : (
          <Link href="/login" className="hover:text-heading">Back to sign in</Link>
        )}
        <span>Invitation only</span>
      </div>
    </form>
  );
}
