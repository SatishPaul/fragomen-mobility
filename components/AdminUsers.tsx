"use client";

import { useEffect, useState } from "react";
import { Check, MailPlus, Save, Trash2, UserRound } from "lucide-react";

type ManagedRole = "admin" | "user";
type ManagedUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: ManagedRole;
  is_active: boolean;
  monthly_token_quota: number;
  accountIds: string[];
};
type SocialAccount = { id: string; platform: string; name: string };

const DEFAULT_MONTHLY_TOKEN_QUOTA = 100_000;

export function AdminUsers() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<ManagedRole>("user");
  const [quota, setQuota] = useState(DEFAULT_MONTHLY_TOKEN_QUOTA);
  const [status, setStatus] = useState("");

  async function load() {
    const response = await fetch("/api/admin/users");
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    setUsers(payload.users);
    setAccounts(payload.accounts);
    setCurrentUserId(payload.currentUserId);
  }

  useEffect(() => {
    void load().catch((error) => setStatus(error.message));
  }, []);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Sending invitation...");
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName, monthlyTokenQuota: quota, role }),
    });
    const payload = await response.json();
    if (!response.ok) return setStatus(payload.error);
    setEmail("");
    setDisplayName("");
    setRole("user");
    setQuota(DEFAULT_MONTHLY_TOKEN_QUOTA);
    setStatus(payload.recovered
      ? "Existing account recovered. A password setup email was sent."
      : "Invitation sent.");
    await load();
  }

  async function save(user: ManagedUser) {
    setStatus(`Saving ${user.email}...`);
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        displayName: user.display_name,
        monthlyTokenQuota: Number(user.monthly_token_quota),
        role: user.role,
        isActive: user.is_active,
        accountIds: user.accountIds,
      }),
    });
    const payload = await response.json();
    setStatus(response.ok ? `${user.email} updated.` : payload.error);
    if (response.ok) await load();
  }

  async function deleteUser(user: ManagedUser) {
    const confirmed = window.confirm(
      `Delete ${user.email}? This permanently removes the account, saved videos, usage history, and publishing records.`,
    );
    if (!confirmed) return;

    setStatus(`Deleting ${user.email}...`);
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    });
    const payload = await response.json();
    setStatus(response.ok ? `${user.email} deleted.` : payload.error);
    if (response.ok) await load();
  }

  function updateUser(id: string, patch: Partial<ManagedUser>) {
    setUsers((current) => current.map((user) => user.id === id ? { ...user, ...patch } : user));
  }

  return (
    <div className="space-y-8">
      <form onSubmit={invite} className="border border-edge bg-surface p-6">
        <div className="flex items-center gap-3">
          <MailPlus className="h-5 w-5 text-accent" />
          <h2 className="font-serif text-xl text-heading">Invite a user</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-[1.2fr_1fr_150px_180px_auto]">
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" className="border border-edge bg-raised px-3 py-2.5 outline-none focus:border-accent" />
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Display name" className="border border-edge bg-raised px-3 py-2.5 outline-none focus:border-accent" />
          <label className="text-xs uppercase text-muted">Role
            <select value={role} onChange={(event) => setRole(event.target.value as ManagedRole)} className="mt-1 w-full border border-edge bg-raised px-3 py-2.5 text-sm normal-case text-heading">
              <option value="user">Regular user</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          <label className="text-xs uppercase text-muted">Monthly AI token limit
            <input required type="number" min="0" value={quota} onChange={(event) => setQuota(Number(event.target.value))} className="mt-1 w-full border border-edge bg-raised px-3 py-2.5 text-sm text-heading outline-none focus:border-accent" />
          </label>
          <button className="self-end bg-accent px-5 py-2.5 font-semibold text-accent-fg">Invite</button>
        </div>
        <p className="mt-3 text-xs text-muted">The 100,000 default is a monthly ceiling for remote AI input and output tokens. Set 0 to block remote AI usage.</p>
      </form>

      {status && <p role="status" className="border-l-2 border-accent pl-3 text-sm text-muted">{status}</p>}

      <section>
        <div className="flex items-center gap-3"><UserRound className="h-5 w-5 text-accent" /><h2 className="font-serif text-xl text-heading">Users</h2></div>
        <div className="mt-4 space-y-3">
          {users.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            return (
              <article key={user.id} className="border border-edge bg-surface p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_180px_160px_120px_auto_auto]">
                  <div><p className="font-medium text-heading">{user.display_name || user.email}</p><p className="mt-1 text-xs text-muted">{user.email}{isCurrentUser ? " · You" : ""}</p></div>
                  <label className="text-xs uppercase text-muted">Monthly AI token limit
                    <input type="number" min="0" value={user.monthly_token_quota} onChange={(event) => updateUser(user.id, { monthly_token_quota: Number(event.target.value) })} className="mt-1 w-full border border-edge bg-raised px-2 py-2 text-sm text-heading" />
                  </label>
                  <label className="text-xs uppercase text-muted">Role
                    <select value={user.role} disabled={isCurrentUser} onChange={(event) => updateUser(user.id, { role: event.target.value as ManagedRole })} className="mt-1 w-full border border-edge bg-raised px-2 py-2 text-sm normal-case text-heading disabled:opacity-60">
                      <option value="user">Regular user</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={user.is_active} disabled={isCurrentUser} onChange={(event) => updateUser(user.id, { is_active: event.target.checked })} />Active</label>
                  <button type="button" onClick={() => void save(user)} title="Save user" className="flex h-10 items-center justify-center gap-2 border border-edge px-4 text-sm text-heading hover:border-accent"><Save className="h-4 w-4" /> Save</button>
                  <button type="button" disabled={isCurrentUser} onClick={() => void deleteUser(user)} title={isCurrentUser ? "You cannot delete your own account" : "Delete user"} className="flex h-10 items-center justify-center gap-2 border border-red-400/40 px-4 text-sm text-red-300 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /> Delete</button>
                </div>

                {accounts.length > 0 && user.role !== "admin" && (
                  <div className="mt-4 border-t border-edge pt-4">
                    <p className="text-xs uppercase text-muted">Allowed social publishing accounts</p>
                    <p className="mb-3 mt-1 text-xs text-muted">Selected accounts are destinations this user may publish to after an explicit confirmation. Assignment never publishes automatically.</p>
                    <div className="flex flex-wrap gap-2">
                      {accounts.map((account) => {
                        const selected = user.accountIds.includes(account.id);
                        return <button key={account.id} type="button" onClick={() => updateUser(user.id, { accountIds: selected ? user.accountIds.filter((id) => id !== account.id) : [...user.accountIds, account.id] })} className={`flex items-center gap-2 border px-3 py-2 text-xs ${selected ? "border-accent bg-accent/10 text-heading" : "border-edge text-muted"}`}>{selected && <Check className="h-3 w-3" />}{account.name} · {account.platform}</button>;
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}