import type { RenderOutput } from "./render";

let latestOutput: RenderOutput | null = null;

export function setLatestRenderOutput(output: RenderOutput): void {
  if (latestOutput?.url && latestOutput.url !== output.url) {
    URL.revokeObjectURL(latestOutput.url);
  }
  latestOutput = output;
}

export function getLatestRenderOutput(): RenderOutput | null {
  return latestOutput;
}

export function clearLatestRenderOutput(): void {
  if (latestOutput?.url) URL.revokeObjectURL(latestOutput.url);
  latestOutput = null;
}