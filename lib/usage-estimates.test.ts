import { describe, expect, it } from "vitest";
import {
  estimateNarrationTokens,
  estimateVoiceover,
  quotaComparisonText,
  VIDEO_RENDER_QUOTA_TOKENS,
} from "./usage-estimates";

describe("generation quota estimates", () => {
  it("counts one vision frame per image and two per video", () => {
    const estimate = estimateNarrationTokens([
      { kind: "image", analysis: "pending" },
      { kind: "video", analysis: "pending" },
    ]);

    expect(estimate.analysisTokens).toBe(2250);
    expect(estimate.totalTokens).toBeGreaterThan(estimate.analysisTokens);
  });

  it("does not charge analysis again for an existing caption", () => {
    const estimate = estimateNarrationTokens([
      { kind: "image", analysis: "done", caption: "A finished caption" },
    ]);

    expect(estimate.analysisTokens).toBe(0);
    expect(estimate.scriptTokens).toBeGreaterThan(3500);
  });

  it("reports voiceover and browser rendering as zero monthly quota tokens", () => {
    const voice = estimateVoiceover([{ line: "A short line for the viewer" }]);

    expect(voice.quotaTokens).toBe(0);
    expect(voice.characters).toBe(27);
    expect(voice.seconds).toBe(3);
    expect(VIDEO_RENDER_QUOTA_TOKENS).toBe(0);
  });

  it("distinguishes one run's estimate from the monthly quota and shortfall", () => {
    expect(
      quotaComparisonText(4424, {
        used: 562,
        reserved: 0,
        limit: 2000,
        remaining: 1438,
      }),
    ).toBe(
      "Monthly quota: 1,438 tokens remaining from a 2,000-token limit; 562 already used or reserved. This run needs about 4,424 tokens, so you are short by about 2,986. Ask an administrator to raise the monthly limit before generating.",
    );
  });

  it("omits a shortfall warning when the run fits within the quota", () => {
    expect(
      quotaComparisonText(500, {
        used: 1000,
        reserved: 0,
        limit: 2000,
        remaining: 1000,
      }),
    ).toBe(
      "Monthly quota: 1,000 tokens remaining from a 2,000-token limit; 1,000 already used or reserved.",
    );
  });
});