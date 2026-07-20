import { afterEach, describe, expect, it, vi } from "vitest";
import { createGateToken, verifyGateToken } from "./gate";
import { requirePublishingSession, requireSameOrigin } from "./publishing-auth";
import {
  sanitizeMediaFilename,
  socialVideoMaxBytes,
  validProviderId,
  validVideoSize,
} from "./publishing-validation";

const cookieStore = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookieStore }));

afterEach(() => {
  vi.unstubAllEnvs();
  cookieStore.mockReset();
});

describe("publishing security", () => {
  it("accepts an unexpired gate token and rejects expiry or tampering", () => {
    const now = Date.UTC(2026, 6, 20);
    const token = createGateToken("secret", now);
    expect(verifyGateToken(token, "secret", now)).toBe(true);
    expect(verifyGateToken(token, "wrong", now)).toBe(false);
    expect(verifyGateToken(`${token}x`, "secret", now)).toBe(false);
    expect(verifyGateToken(token, "secret", now + 31 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("rejects cross-origin publishing requests", () => {
    expect(() => requireSameOrigin(new Request("https://app.example/api", {
      headers: { origin: "https://evil.example" },
    }))).toThrow("Cross-origin publishing requests are not allowed.");
    expect(() => requireSameOrigin(new Request("https://app.example/api", {
      headers: { origin: "https://app.example" },
    }))).not.toThrow();
  });

  it("requires configuration and a valid signed session cookie", async () => {
    vi.stubEnv("APP_PASSWORD", "secret");
    cookieStore.mockResolvedValue({
      get: () => ({ value: createGateToken("secret") }),
    });
    await expect(requirePublishingSession()).resolves.toBeUndefined();

    cookieStore.mockResolvedValue({ get: () => ({ value: "invalid" }) });
    await expect(requirePublishingSession()).rejects.toThrow("Your session has expired.");

    vi.stubEnv("APP_PASSWORD", "");
    await expect(requirePublishingSession()).rejects.toThrow("requires APP_PASSWORD");
  });

  it("validates provider identifiers", () => {
    expect(validProviderId("account_123-ABC")).toBe(true);
    expect(validProviderId("")).toBe(false);
    expect(validProviderId("../../account")).toBe(false);
    expect(validProviderId("a".repeat(129))).toBe(false);
  });

  it("sanitizes MP4 filenames and rejects missing names", () => {
    expect(sanitizeMediaFilename("Project launch!.MP4")).toBe("Project-launch-.mp4");
    expect(sanitizeMediaFilename("a".repeat(130))).toBe(`${"a".repeat(120)}.mp4`);
    expect(sanitizeMediaFilename(undefined)).toBeNull();
    expect(sanitizeMediaFilename(".mp4")).toBeNull();
  });

  it("uses a safe video limit and validates positive integer sizes", () => {
    expect(socialVideoMaxBytes("1024")).toBe(1024);
    expect(socialVideoMaxBytes("invalid")).toBe(500 * 1024 * 1024);
    expect(validVideoSize(1024, 1024)).toBe(true);
    expect(validVideoSize(1025, 1024)).toBe(false);
    expect(validVideoSize(0, 1024)).toBe(false);
    expect(validVideoSize(1.5, 1024)).toBe(false);
  });
});