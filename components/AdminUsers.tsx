"use client";

import { useEffect, useState } from "react";
import { Check, MailPlus, Save, UserRound } from "lucide-react";

type ManagedUser = { id: string; email: string; display_name: string | null; role: string; is_active: boolean; monthly_token_quota: number; accountIds: string[] };
type SocialAccount = { id: string; platform: string; name: string };

export function AdminUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [quota, setQuota] = useState(100000);
  const [status, setStatus] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    setUsers(payload.users);
    setAccounts(payload.accounts);
  }

  useEffect(() => { void load().catch((error) => setStatus(error.message)); }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Sending invitation...");
    const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, displayName, monthlyTokenQuota: quota }) });
    const payload = await response.json();
    if (!response.ok) return setStatus(payload.error);
    setEmail(""); setDisplayName(""); setStatus("Invitation sent."); await load();
  }

  async function save(user: ManagedUser) {
    setStatus(`Saving ${user.email}...`);
    const response = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.id, displayName: user.display_name, monthlyTokenQuota: Number(user.monthly_token_quota), isActive: user.is_active, accountIds: user.accountIds }) });
    const payload = await response.json();
    setStatus(response.ok ? `${user.email} updated.` : payload.error);
    if (response.ok) await load();
  }

  function updateUser(id: string, patch: Partial<ManagedUser>) { setUsers((current) => current.map((user) => user.id === id ? { ...user, ...patch } : user)); }

  return <div className="space-y-8"><form onSubmit={invite} className="border border-edge bg-surface p-6"><div className="flex items-center gap-3"><MailPlus className="h-5 w-5 text-accent" /><h2 className="font-serif text-xl text-heading">Invite a user</h2></div><div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_180px_auto]"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="border border-edge bg-raised px-3 py-2.5 outline-none focus:border-accent" /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" className="border border-edge bg-raised px-3 py-2.5 outline-none focus:border-accent" /><input required type="number" min="0" value={quota} onChange={(event) => setQuota(Number(event.target.value))} aria-label="Monthly token quota" className="border border-edge bg-raised px-3 py-2.5 outline-none focus:border-accent" /><button className="bg-accent px-5 py-2.5 font-semibold text-accent-fg">Invite</button></div></form>
    {status && <p role="status" className="border-l-2 border-accent pl-3 text-sm text-muted">{status}</p>}
    <section><div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-accent" /><h2 className="font-serif text-xl text-heading">Users</h2></div><div className="mt-4 space-y-3">{users.map((user) => <article key={user.id} className="border border-edge bg-surface p-5"><div className="grid gap-4 lg:grid-cols-[1fr_180px_130px_auto]"><div><p className="font-medium text-heading">{user.display_name || user.email}</p><p className="mt-1 text-xs text-muted">{user.email} · {user.role}</p></div><label className="text-xs uppercase text-muted">Monthly quota<input type="number" min="0" value={user.monthly_token_quota} onChange={(event) => updateUser(user.id, { monthly_token_quota: Number(event.target.value) })} className="mt-1 w-full border border-edge bg-raised px-2 py-2 text-sm text-heading" /></label><label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={user.is_active} disabled={user.role === "admin"} onChange={(event) => updateUser(user.id, { is_active: event.target.checked })} />Active</label><button onClick={() => void save(user)} title="Save user" className="flex h-10 items-center justify-center gap-2 border border-edge px-4 text-sm text-heading hover:border-accent"><Save className="h-4 w-4" />Save</button></div>{accounts.length > 0 && user.role !== "admin" && <div className="mt-4 border-t border-edge pt-4"><p className="mb-2 text-xs uppercase text-muted">Assigned social accounts</p><div className="flex flex-wrap gap-2">{accounts.map((account) => { const selected = user.accountIds.includes(account.id); return <button key={account.id} type="button" onClick={() => updateUser(user.id, { accountIds: selected ? user.accountIds.filter((id) => id !== account.id) : [...user.accountIds, account.id] })} className={`flex items-center gap-2 border px-3 py-2 text-xs ${selected ? "border-accent bg-accent/10 text-heading" : "border-edge text-muted"}`}>{selected && <Check className="h-3 w-3" />}{account.name} · {account.platform}</button>; })}</div></div>}</article>)}</div></section></div>;
}
