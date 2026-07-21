import type { RenderOutput } from "./render";

let latestOutput: RenderOutput | null = null;
let latestSavedVideoId: string | null = null;

export function setLatestRenderOutput(output: RenderOutput): void {
  if (latestOutput?.url && latestOutput.url !== output.url) {
    URL.revokeObjectURL(latestOutput.url);
  }
  latestOutput = output;
}

export function getLatestRenderOutput(): RenderOutput | null {
  return latestOutput;
}

export function setLatestSavedVideoId(videoId: string | null): void {
  latestSavedVideoId = videoId;
}

export function getLatestSavedVideoId(): string | null {
  return latestSavedVideoId;
}

export function clearLatestRenderOutput(): void {
  if (latestOutput?.url) URL.revokeObjectURL(latestOutput.url);
  latestOutput = null;
  latestSavedVideoId = null;
}