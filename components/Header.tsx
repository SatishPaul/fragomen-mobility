"use client";

import Image from "next/image";
import Link from "next/link";
import { LogOut, Settings, Shield, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

type HeaderProfile = { display_name: string | null; role: string };

export function Header() {
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;

    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const result = await supabase
        .from("profiles")
        .select("display_name,role")
        .eq("id", user.id)
        .single<HeaderProfile>();
      setProfile(result.data);
    });
  }, [configured]);

  return (
    <header className="sticky top-0 z-40 border-b border-edge/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image src={brand.logo} alt={brand.name} width={150} height={40} priority />
        </Link>
        <nav className="flex items-center gap-1" aria-label="Primary navigation">
          {profile && <Link href="/dashboard" className="px-3 py-2 text-sm text-muted hover:text-heading">Dashboard</Link>}
          {profile?.role === "admin" && <Link href="/admin" title="Administration" className="p-2 text-muted hover:text-heading"><Shield className="h-4 w-4" /></Link>}
          {profile && <Link href="/profile" title="Profile" className="p-2 text-muted hover:text-heading"><Settings className="h-4 w-4" /></Link>}
          {profile && <form action="/auth/logout" method="post"><button type="submit" title="Sign out" className="p-2 text-muted hover:text-heading"><LogOut className="h-4 w-4" /></button></form>}
          {!profile && configured && <Link href="/login" className="px-3 py-2 text-sm text-muted hover:text-heading">Sign in</Link>}
          <Link href="/create" className="ml-2 flex items-center gap-2 bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:brightness-110"><Video className="h-4 w-4" />Create video</Link>
        </nav>
      </div>
    </header>
  );
}
