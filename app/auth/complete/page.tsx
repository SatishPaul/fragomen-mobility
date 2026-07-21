"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { readFragmentSession, safeAuthDestination } from "@/lib/auth-callback";
import { createClient } from "@/lib/supabase/client";

function CompleteAuth() {
  const [message, setMessage] = useState("Completing your secure sign-in...");
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function complete() {
      const session = readFragmentSession(window.location.hash);
      const next = safeAuthDestination(searchParams.get("next"));

      if (!session) {
        router.replace("/login?error=expired_link");
        return;
      }

      const { error } = await createClient().auth.setSession({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
      });
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      if (error) {
        router.replace("/login?error=expired_link");
        return;
      }

      setMessage("Sign-in complete. Redirecting...");
      router.replace(next);
      router.refresh();
    }

    void complete();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md border border-edge bg-surface p-8 text-center">
        <p className="text-xs font-semibold uppercase text-accent">VideoMaker account</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-heading">Securing your account</h1>
        <p role="status" className="mt-4 text-sm text-muted">{message}</p>
      </div>
    </main>
  );
}

function CompletionStatus() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md border border-edge bg-surface p-8 text-center">
        <p className="text-xs font-semibold uppercase text-accent">VideoMaker account</p>
        <h1 className="mt-3 font-serif text-3xl font-semibold text-heading">Securing your account</h1>
        <p role="status" className="mt-4 text-sm text-muted">Preparing your secure sign-in...</p>
      </div>
    </main>
  );
}

export default function CompleteAuthPage() {
  return <Suspense fallback={<CompletionStatus />}><CompleteAuth /></Suspense>;
}