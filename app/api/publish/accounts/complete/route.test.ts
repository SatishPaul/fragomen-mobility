import { beforeEach, describe, expect, it, vi } from "vitest";

const publishingAuth = vi.hoisted(() => ({
  requirePublishingSession: vi.fn(),
  requireSameOrigin: vi.fn(),
}));
const outstand = vi.hoisted(() => ({
  finalizePendingConnection: vi.fn(),
  getPendingConnection: vi.fn(),
  listSocialAccounts: vi.fn(),
}));
const socialConnection = vi.hoisted(() => ({ readSocialConnectionToken: vi.fn() }));
const supabase = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue({ value: "signed-token" }) }),
}));
vi.mock("@/lib/server/publishing-auth", () => publishingAuth);
vi.mock("@/lib/server/outstand", () => ({
  ...outstand,
  OutstandError: class OutstandError extends Error {
    status = 502;
  },
}));
vi.mock("@/lib/server/social-connection", () => ({
  socialConnectionCookie: "vm_social_connect",
  readSocialConnectionToken: socialConnection.readSocialConnectionToken,
}));
vi.mock("@/lib/supabase/admin", () => supabase);

import { POST } from "./route";

function request(body: Record<string, string | null> = {
  success: "true",
  accountId: "new_1",
  username: "new-user",
}, origin = "https://app.example"): Request {
  return new Request("https://app.example/api/publish/accounts/complete", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function adminClient(existingUserId?: string) {
  const lookupEq = vi.fn().mockResolvedValue({
    data: existingUserId ? [{ user_id: existingUserId, outstand_account_id: "new_1" }] : [],
    error: null,
  });
  const select = vi.fn().mockReturnValue({ eq: lookupEq });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  supabase.createAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue({ select, insert, update }),
  });
  return { insert, lookupEq, update, updateEq };
}

describe("social account completion route", () => {
  beforeEach(() => {
    vi.stubEnv("OUTSTAND_API_KEY", "test-secret");
    publishingAuth.requirePublishingSession.mockReset().mockResolvedValue({ userId: "user_1" });
    publishingAuth.requireSameOrigin.mockReset();
    socialConnection.readSocialConnectionToken.mockReset().mockReturnValue({
      userId: "user_1",
      network: "linkedin",
      expiresAt: Date.now() + 60_000,
    });
    outstand.listSocialAccounts.mockReset().mockResolvedValue([
      { id: "old_1", network: "linkedin", nickname: "Old", username: "old", isActive: true },
      {
        id: "new_1",
        network: "linkedin",
        nickname: "New account",
        username: "new-user",
        profile_picture_url: "https://images.example/new.png",
        isActive: true,
      },
      { id: "new_2", network: "instagram", nickname: "Other network", username: "other", isActive: true },
    ]);
    outstand.getPendingConnection.mockReset();
    outstand.finalizePendingConnection.mockReset();
    supabase.createAdminClient.mockReset();
  });

  it("rejects a missing, expired, or tampered connection snapshot", async () => {
    socialConnection.readSocialConnectionToken.mockReturnValue(null);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The social connection expired. Connect the account again." });
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a snapshot created by another user", async () => {
    socialConnection.readSocialConnectionToken.mockReturnValue({
      userId: "user_2",
      network: "linkedin",
      expiresAt: Date.now() + 60_000,
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The social connection expired. Connect the account again." });
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a callback without Outstand success and account proof", async () => {
    const response = await POST(request({ success: "false", accountId: null, username: null }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Outstand did not confirm the social account connection. Connect the account again.",
    });
    expect(outstand.listSocialAccounts).not.toHaveBeenCalled();
  });

  it("rejects an account that Outstand cannot verify for the user tenant", async () => {
    outstand.listSocialAccounts.mockResolvedValue([]);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Outstand could not verify this account for the signed-in user." });
    expect(outstand.listSocialAccounts).toHaveBeenCalledWith("user_1");
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an account already assigned to another user", async () => {
    const { insert, update } = adminClient("user_2");

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The connected social account is already assigned to another user." });
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("assigns the exact callback account for the selected network", async () => {
    const { insert } = adminClient();

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accounts: [{ id: "new_1", network: "linkedin", nickname: "New account", username: "new-user" }],
    });
    expect(insert).toHaveBeenCalledWith([{
      user_id: "user_1",
      outstand_account_id: "new_1",
      platform: "linkedin",
      account_name: "New account",
      account_metadata: { username: "new-user", profilePictureUrl: "https://images.example/new.png" },
      is_active: true,
      assigned_by: "user_1",
    }]);
    expect(response.headers.get("set-cookie")).toContain("vm_social_connect=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("reactivates a reused account already assigned to the same user", async () => {
    const { insert, update, updateEq } = adminClient("user_1");

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      user_id: "user_1",
      outstand_account_id: "new_1",
      platform: "linkedin",
      account_name: "New account",
      account_metadata: { username: "new-user", profilePictureUrl: "https://images.example/new.png" },
      is_active: true,
      assigned_by: "user_1",
    });
    expect(updateEq).toHaveBeenCalledWith("outstand_account_id", "new_1");
  });

  it("returns pending choices without consuming a multi-profile connection", async () => {
    outstand.getPendingConnection.mockResolvedValue({
      network: "linkedin",
      expiresAt: Date.now() + 60_000,
      availablePages: [
        { id: "personal", type: "personal", name: "JC", username: "jc" },
        { id: "company", type: "organization", name: "Company", username: "company" },
      ],
    });

    const response = await POST(request({ pendingSession: "pending-token" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pending: { pages: [
      { id: "personal", type: "personal", name: "JC", username: "jc" },
      { id: "company", type: "organization", name: "Company", username: "company" },
    ] } });
    expect(outstand.finalizePendingConnection).not.toHaveBeenCalled();
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("automatically finalizes and assigns a single pending profile", async () => {
    outstand.getPendingConnection.mockResolvedValue({
      network: "linkedin",
      expiresAt: Date.now() + 60_000,
      availablePages: [{ id: "personal", type: "personal", name: "JC", username: "new-user" }],
    });
    outstand.finalizePendingConnection.mockResolvedValue([{
      id: "new_1",
      network: "linkedin",
      nickname: "New account",
      username: "new-user",
      isActive: true,
    }]);
    const { insert } = adminClient();

    const response = await POST(request({ pendingSession: "pending-token" }));

    expect(response.status).toBe(200);
    expect(outstand.finalizePendingConnection).toHaveBeenCalledWith("pending-token", ["personal"]);
    expect(outstand.listSocialAccounts).toHaveBeenCalledWith("user_1");
    expect(insert).toHaveBeenCalledOnce();
  });
});