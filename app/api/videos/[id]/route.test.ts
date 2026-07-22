import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ requireUserApi: vi.fn() }));

vi.mock("@/lib/server/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/auth")>(),
  requireUserApi: auth.requireUserApi,
}));

import { AuthorizationError } from "@/lib/server/auth";
import { GET } from "./route";

type Profile = { id: string; role: "admin" | "user" };

function authenticatedContext(profile: Profile, video: Record<string, string> | null = {
  storage_path: "user/video.mp4",
  filename: "video.mp4",
  mime_type: "video/mp4",
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: video }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://storage.example/video" } });
  auth.requireUserApi.mockResolvedValue({
    profile,
    supabase: {
      from: vi.fn().mockReturnValue(query),
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    },
  });
  return { query, createSignedUrl };
}

function request(search = "", range?: string): Request {
  return new Request(`https://app.example/api/videos/video_1${search}`, {
    headers: range ? { Range: range } : undefined,
  });
}

const context = { params: Promise.resolve({ id: "video_1" }) };

describe("video stream route", () => {
  beforeEach(() => {
    auth.requireUserApi.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("video", {
      status: 206,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": "5",
        "Content-Range": "bytes 0-4/5",
      },
    })));
  });

  it("returns 401 instead of redirecting signed-out users", async () => {
    auth.requireUserApi.mockRejectedValue(new AuthorizationError("Authentication required.", 401));

    const response = await GET(request(), context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required." });
  });

  it("filters regular-user video lookup by owner", async () => {
    const { query } = authenticatedContext({ id: "user_1", role: "user" });

    await GET(request(), context);

    expect(query.eq).toHaveBeenCalledWith("id", "video_1");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user_1");
  });

  it("allows administrators to look up managed videos without owner filtering", async () => {
    const { query } = authenticatedContext({ id: "admin_1", role: "admin" });

    await GET(request(), context);

    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(query.eq).toHaveBeenCalledWith("id", "video_1");
  });

  it("returns 404 without requesting storage when the video is unavailable", async () => {
    const { createSignedUrl } = authenticatedContext({ id: "user_1", role: "user" }, null);

    const response = await GET(request(), context);

    expect(response.status).toBe(404);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("forwards a valid range and returns private partial content", async () => {
    authenticatedContext({ id: "user_1", role: "user" });

    const response = await GET(request("", "bytes=0-4"), context);

    expect(fetch).toHaveBeenCalledWith("https://storage.example/video", { headers: { Range: "bytes=0-4" } });
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 0-4/5");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("adds a sanitized attachment header only for downloads", async () => {
    authenticatedContext({ id: "user_1", role: "user" }, {
      storage_path: "user/video.mp4",
      filename: "unsafe\r\nname.mp4",
      mime_type: "video/mp4",
    });

    const response = await GET(request("?download=1"), context);

    expect(response.headers.get("content-disposition")).toBe("attachment; filename=\"unsafe--name.mp4\"");
  });
});