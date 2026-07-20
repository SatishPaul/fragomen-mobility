import { describe, expect, it } from "vitest";
import {
  allOutcomesTerminal,
  composePostContent,
  failedAccountIds,
  type PublishOutcome,
} from "./publishing";

function outcome(id: string, status: PublishOutcome["status"]): PublishOutcome {
  return {
    id,
    network: "instagram",
    username: id,
    status,
    error: status === "failed" ? "Rejected" : null,
    platformPostUrl: status === "published" ? `https://example.com/${id}` : null,
  };
}

describe("publishing decisions", () => {
  it("composes trimmed title and caption without blank separators", () => {
    expect(composePostContent(" Title ", " Caption ")).toBe("Title\n\nCaption");
    expect(composePostContent("", " Caption ")).toBe("Caption");
  });

  it("targets only failed accounts during retry", () => {
    const outcomes = [outcome("published", "published"), outcome("failed", "failed"), outcome("pending", "pending")];
    expect(failedAccountIds(outcomes)).toEqual(["failed"]);
  });

  it("requires at least one outcome and no pending accounts for terminal state", () => {
    expect(allOutcomesTerminal([])).toBe(false);
    expect(allOutcomesTerminal([outcome("one", "published"), outcome("two", "failed")])).toBe(true);
    expect(allOutcomesTerminal([outcome("one", "pending")])).toBe(false);
  });
});