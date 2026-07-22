import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Header } from "@/components/Header";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/server/auth";

export default async function ProfilePage() {
  const { profile } = await requireUser();

  return (
    <><Header /><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><p className="text-xs font-semibold uppercase text-accent">Account</p><h1 className="mt-2 font-serif text-3xl text-heading">Profile and security</h1><p className="mb-8 mt-2 text-sm text-muted">Manage your identity and account access.</p><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"><ProfileForm userId={profile.id} email={profile.email} initialName={profile.display_name || ""} /><section className="border border-edge bg-surface p-6"><KeyRound className="h-5 w-5 text-accent" aria-hidden="true" /><h2 className="mt-4 font-serif text-xl text-heading">Password</h2><p className="mt-2 text-sm text-muted">Send a secure password-reset link to your account email. Existing sessions remain protected by Supabase authentication.</p><Link href="/forgot-password" className="mt-5 inline-block border border-edge px-4 py-2.5 text-sm font-semibold text-body hover:border-accent">Reset password</Link></section></div></main></>
  );
}
