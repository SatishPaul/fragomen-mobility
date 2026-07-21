import { Header } from "@/components/Header";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/server/auth";

export default async function ProfilePage() {
  const { profile } = await requireUser();

  return (
    <><Header /><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><p className="text-xs font-semibold uppercase text-accent">Account</p><h1 className="mt-2 font-serif text-3xl text-heading">Profile</h1><p className="mb-8 mt-2 text-sm text-muted">Manage how your name appears across VideoMaker.</p><ProfileForm userId={profile.id} email={profile.email} initialName={profile.display_name || ""} /></main></>
  );
}
