import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validOutstandSignature } from "@/lib/server/outstand-webhook";

describe("Outstand webhook signatures", () => {
  const secret = "test-webhook-secret";
  const payload = JSON.stringify({ event: "post.published", timestamp: "2026-07-20T10:00:00Z" });

  it("accepts the documented HMAC-SHA256 signature", () => {
    const signature = `sha256=${createHmac("sha256", secret).update(payload, "utf8").digest("hex")}`;
    expect(validOutstandSignature(payload, signature, secret)).toBe(true);
  });

  it("rejects missing, malformed, and payload-mismatched signatures", () => {
    const signature = `sha256=${createHmac("sha256", secret).update(payload, "utf8").digest("hex")}`;
    expect(validOutstandSignature(payload, null, secret)).toBe(false);
    expect(validOutstandSignature(payload, "sha256=short", secret)).toBe(false);
    expect(validOutstandSignature(`${payload} `, signature, secret)).toBe(false);
  });
});