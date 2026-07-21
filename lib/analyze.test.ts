import { describe, expect, it } from "vitest";
import { aiFailureMessage, shouldRetryAiRequest } from "./analyze";

describe("AI request failure handling", () => {
  it("retries transient provider and rate-limit responses", () => {
    expect(shouldRetryAiRequest(429, "rate_limited")).toBe(true);
    expect(shouldRetryAiRequest(502, "provider_unavailable")).toBe(true);
    expect(shouldRetryAiRequest(503)).toBe(true);
  });

  it("does not retry authentication or monthly quota failures", () => {
    expect(shouldRetryAiRequest(401, "authentication_required")).toBe(false);
    expect(shouldRetryAiRequest(429, "quota_exceeded")).toBe(false);
  });

  it("provides actionable messages without provider internals", () => {
    expect(aiFailureMessage(429, "quota_exceeded")).toContain("monthly AI token limit");
    expect(aiFailureMessage(429, "rate_limited")).toContain("Wait a minute");
    expect(aiFailureMessage(502, "provider_unavailable")).toContain("temporarily unavailable");
    expect(aiFailureMessage(401, "authentication_required")).toContain("Sign in again");
  });
});
