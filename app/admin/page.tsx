import { AdminUsers } from "@/components/AdminUsers";
import { Header } from "@/components/Header";
import { requireAdmin } from "@/lib/server/auth";

export default async function AdminPage() {
  await requireAdmin();
  return <><Header /><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><p className="text-xs font-semibold uppercase text-accent">Administration</p><h1 className="mt-2 font-serif text-3xl text-heading">Users and access</h1><p className="mb-8 mt-2 text-sm text-muted">Invite users, set monthly quotas, and control which social accounts they can publish to.</p><AdminUsers /></main></>;
}