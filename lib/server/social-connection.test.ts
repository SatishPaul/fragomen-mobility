import { describe, expect, it } from "vitest";
import { createSocialConnectionToken, readSocialConnectionToken } from "./social-connection";

describe("social connection tokens", () => {
  const now = Date.UTC(2026, 6, 21);
  const snapshot = { userId: "user-1", network: "linkedin" as const };

  it("round trips a signed connection snapshot", () => {
    expect(readSocialConnectionToken(createSocialConnectionToken(snapshot, "secret", now), "secret", now)).toMatchObject(snapshot);
  });

  it("rejects tampering, the wrong secret, and expiry", () => {
    const token = createSocialConnectionToken(snapshot, "secret", now);
    expect(readSocialConnectionToken(`${token}x`, "secret", now)).toBeNull();
    expect(readSocialConnectionToken(token, "wrong", now)).toBeNull();
    expect(readSocialConnectionToken(token, "secret", now + 11 * 60 * 1000)).toBeNull();
  });
});