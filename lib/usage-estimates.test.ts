import { describe, expect, it } from "vitest";
import {
  estimateNarrationTokens,
  estimateVoiceover,
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
});