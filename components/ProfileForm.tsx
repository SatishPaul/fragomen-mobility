"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({ userId, email, initialName }: { userId: string; email: string; initialName: string }) {
  const [displayName, setDisplayName] = useState(initialName);
  const [nextEmail, setNextEmail] = useState(email);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", userId);
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    if (nextEmail.trim().toLowerCase() !== email.toLowerCase()) {
      const { error: emailError } = await supabase.auth.updateUser({
        email: nextEmail.trim().toLowerCase(),
      });
      setMessage(emailError ? emailError.message : "Profile updated. Confirm the email change from the messages sent to your addresses.");
    } else {
      setMessage("Profile updated.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="max-w-xl border border-edge bg-surface p-6">
      <label className="block text-sm font-medium text-heading">
        Display name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full border border-edge bg-raised px-3 py-3 outline-none focus:border-accent" />
      </label>
      <label className="mt-5 block text-sm font-medium text-heading">
        Email
        <input type="email" required value={nextEmail} onChange={(event) => setNextEmail(event.target.value)} className="mt-2 w-full border border-edge bg-raised px-3 py-3 outline-none focus:border-accent" />
      </label>
      <p className="mt-2 text-xs text-muted">Changing email requires confirmation. Your current address remains active until confirmation succeeds.</p>
      {message && <p role="status" className="mt-4 text-sm text-muted">{message}</p>}
      <button type="submit" disabled={busy} className="mt-5 bg-accent px-5 py-2.5 font-semibold text-accent-fg disabled:opacity-50">
        {busy ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
