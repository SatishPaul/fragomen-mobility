import type { Asset, Scene } from "./types";

const VISION_FRAME_TOKENS = 750;
const SCRIPT_OUTPUT_TOKENS = 3500;
const SCRIPT_PROMPT_BASE_CHARACTERS = 3200;
const ESTIMATED_CAPTION_CHARACTERS = 600;
const SPOKEN_WORDS_PER_SECOND = 2.3;

type EstimateAsset = Pick<Asset, "kind" | "caption" | "analysis">;
type EstimateScene = Pick<Scene, "line">;

export type NarrationEstimate = {
  analysisTokens: number;
  scriptTokens: number;
  totalTokens: number;
};

export function estimateNarrationTokens(
  assets: EstimateAsset[],
  context = "",
): NarrationEstimate {
  const analysisTokens = assets.reduce((total, asset) => {
    if (asset.caption || asset.analysis === "done") return total;
    return total + (asset.kind === "video" ? 2 : 1) * VISION_FRAME_TOKENS;
  }, 0);
  const captionCharacters = assets.reduce(
    (total, asset) => total + (asset.caption?.length || ESTIMATED_CAPTION_CHARACTERS),
    0,
  );
  const promptTokens = Math.ceil(
    (SCRIPT_PROMPT_BASE_CHARACTERS + context.length + captionCharacters) / 4,
  );
  const scriptTokens = SCRIPT_OUTPUT_TOKENS + promptTokens;

  return {
    analysisTokens,
    scriptTokens,
    totalTokens: analysisTokens + scriptTokens,
  };
}

export function estimateVoiceover(scenes: EstimateScene[]) {
  const text = scenes.map((scene) => scene.line.trim()).filter(Boolean).join(" ");
  const words = text ? text.split(/\s+/).length : 0;

  return {
    quotaTokens: 0,
    characters: text.length,
    seconds: Math.ceil(words / SPOKEN_WORDS_PER_SECOND),
  };
}

export const VIDEO_RENDER_QUOTA_TOKENS = 0;