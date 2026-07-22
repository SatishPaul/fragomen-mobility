import { beforeEach, describe, expect, it, vi } from "vitest";

const publishingAuth = vi.hoisted(() => ({
  requirePublishingSession: vi.fn(),
  requireSameOrigin: vi.fn(),
}));
const outstand = vi.hoisted(() => ({ listSocialAccounts: vi.fn() }));
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

function request(origin = "https://app.example"): Request {
  return new Request("https://app.example/api/publish/accounts/complete", {
    method: "POST",
    headers: { origin },
  });
}

function adminClient(existingIds: string[] = []) {
  const assignmentLookup = {
    select: vi.fn(),
    in: vi.fn().mockResolvedValue({
      data: existingIds.map((outstand_account_id) => ({ outstand_account_id })),
      error: null,
    }),
  };
  assignmentLookup.select.mockReturnValue(assignmentLookup);
  const insert = vi.fn().mockResolvedValue({ error: null });
  supabase.createAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue({ ...assignmentLookup, insert }),
  });
  return { insert };
}

describe("social account completion route", () => {
  beforeEach(() => {
    vi.stubEnv("OUTSTAND_API_KEY", "test-secret");
    publishingAuth.requirePublishingSession.mockReset().mockResolvedValue({ userId: "user_1" });
    publishingAuth.requireSameOrigin.mockReset();
    socialConnection.readSocialConnectionToken.mockReset().mockReturnValue({
      userId: "user_1",
      network: "linkedin",
      existingAccountIds: ["old_1"],
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
      existingAccountIds: [],
      expiresAt: Date.now() + 60_000,
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The social connection expired. Connect the account again." });
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects completion when no new account exists for the requested network", async () => {
    outstand.listSocialAccounts.mockResolvedValue([
      { id: "old_1", network: "linkedin", nickname: "Old", username: "old", isActive: true },
      { id: "new_2", network: "instagram", nickname: "Other network", username: "other", isActive: true },
    ]);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No new social account was detected. Reconnect the account and try again." });
    expect(supabase.createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an account already assigned to another user", async () => {
    const { insert } = adminClient(["new_1"]);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The connected social account is already assigned to another user." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("assigns only the newly connected account for the selected network", async () => {
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
});