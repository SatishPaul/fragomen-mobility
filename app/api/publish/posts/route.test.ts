import { beforeEach, describe, expect, it, vi } from "vitest";

const outstand = vi.hoisted(() => ({
  createPost: vi.fn(),
  listSocialAccounts: vi.fn(),
}));

vi.mock("@/lib/server/outstand", () => ({
  ...outstand,
  OutstandError: class OutstandError extends Error {
    status = 502;
  },
}));
vi.mock("@/lib/server/publishing-auth", () => ({
  requirePublishingSession: vi.fn().mockResolvedValue(undefined),
  requireSameOrigin: vi.fn(),
}));
vi.mock("@/lib/server/throttle", () => ({
  clientIp: vi.fn().mockReturnValue("test"),
  throttled: vi.fn().mockReturnValue(false),
}));

import { POST } from "./route";

function request(accountIds: string[]): Request {
  return new Request("https://app.example/api/publish/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://app.example",
    },
    body: JSON.stringify({ accountIds, content: "Caption", mediaId: "media_1" }),
  });
}

describe("publish post route", () => {
  beforeEach(() => {
    outstand.createPost.mockReset();
    outstand.listSocialAccounts.mockReset();
    outstand.listSocialAccounts.mockResolvedValue([
      { id: "healthy_1", nickname: "Healthy", network: "instagram", username: "healthy", isActive: true },
      { id: "inactive_1", nickname: "Inactive", network: "linkedin", username: "inactive", isActive: false },
      { id: "pinterest_1", nickname: "Pinterest", network: "pinterest", username: "board", isActive: true },
    ]);
    outstand.createPost.mockResolvedValue({ id: "post_1" });
  });

  it("creates a post for the exact active supported account once", async () => {
    const response = await POST(request(["healthy_1", "healthy_1"]));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "post_1" });
    expect(outstand.createPost).toHaveBeenCalledOnce();
    expect(outstand.createPost).toHaveBeenCalledWith({
      content: "Caption",
      accounts: ["healthy_1"],
      mediaIds: ["media_1"],
    });
  });

  it.each([["missing_1"], ["inactive_1"], ["pinterest_1"]])(
    "rejects disconnected, inactive, or disabled accounts: %s",
    async (accountIds) => {
      const response = await POST(request(accountIds));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "One or more selected accounts are no longer connected." });
      expect(outstand.createPost).not.toHaveBeenCalled();
    },
  );
});