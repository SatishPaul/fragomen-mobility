"use client";

import { useEffect } from "react";
import { isSupabaseAuthFragment } from "@/lib/auth-callback";

export function AuthFragmentBridge() {
  useEffect(() => {
    if (!isSupabaseAuthFragment(window.location.hash)) return;
    window.location.replace(`/auth/complete?next=/reset-password${window.location.hash}`);
  }, []);

  return null;
}