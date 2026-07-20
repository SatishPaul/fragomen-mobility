"use client";

import { limits } from "@/config/templates";
import type { Asset } from "./types";

/** Client-side media helpers: validation, thumbnails, frames, downscaling. */

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export function fileKind(file: File): "image" | "video" | null {
  if (IMAGE_TYPES.includes(file.type)) return "image";
  if (VIDEO_TYPES.includes(file.type)) return "video";
  // iOS sometimes reports empty types; fall back to the extension.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "heic"].includes(ext)) return "image";
  if (["mp4", "mov", "webm"].includes(ext)) return "video";
  return null;
}

export interface RejectedFile {
  name: string;
  reason: string;
}

/** Validates a batch of picked files against the PRD caps. */
export function validateFiles(
  files: File[],
  existingCount: number,
): { ok: File[]; rejected: RejectedFile[] } {
  const ok: File[] = [];
  const rejected: RejectedFile[] = [];
  for (const file of files) {
    const kind = fileKind(file);
    if (!kind) {
      rejected.push({ name: file.name, reason: "Unsupported type (use JPG, PNG, MP4 or MOV)" });
      continue;
    }
    if (existingCount + ok.length >= limits.maxAssets) {
      rejected.push({ name: file.name, reason: `Project is capped at ${limits.maxAssets} assets` });
      continue;
    }
    if (kind === "image" && file.size > limits.maxImageBytes) {
      rejected.push({ name: file.name, reason: "Images must be ≤ 15 MB" });
      continue;
    }
    if (kind === "video" && file.size > limits.maxVideoBytes) {
      rejected.push({ name: file.name, reason: "Clips must be ≤ 200 MB" });
      continue;
    }
    ok.push(file);
  }
  return { ok, rejected };
}

/** Decodes an image Blob to a bitmap, applying EXIF orientation. */
export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

function drawCover(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
  return canvas;
}

/** Renders an image blob to a crop-covered JPEG at the given size. */
export async function imageToJpeg(
  blob: Blob,
  width: number,
  height: number,
  quality = 0.85,
): Promise<Blob> {
  const bmp = await decodeImage(blob);
  const canvas = drawCover(bmp, bmp.width, bmp.height, width, height);
  bmp.close();
  return canvasToBlob(canvas, quality);
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))),
      "image/jpeg",
      quality,
    ),
  );
}

/** Small square thumbnail data-URL for the asset grid. */
export async function makeImageThumb(blob: Blob): Promise<string> {
  const bmp = await decodeImage(blob);
  const canvas = drawCover(bmp, bmp.width, bmp.height, 320, 320);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.7);
}

/** Loads a video blob into an off-DOM <video> ready for seeking. */
async function loadVideo(blob: Blob): Promise<{ video: HTMLVideoElement; revoke: () => void }> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not read this video"));
  });
  return { video, revoke: () => URL.revokeObjectURL(url) };
}

async function seekFrame(video: HTMLVideoElement, time: number): Promise<HTMLCanvasElement> {
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error("Seek failed"));
    video.currentTime = time;
  });
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  return canvas;
}

/** Duration + poster thumbnail for a video clip. */
export async function probeVideo(blob: Blob): Promise<{ duration: number; thumb: string }> {
  const { video, revoke } = await loadVideo(blob);
  try {
    const duration = video.duration;
    const frame = await seekFrame(video, Math.min(0.5, duration / 2));
    const thumb = drawCover(frame, frame.width, frame.height, 320, 320).toDataURL(
      "image/jpeg",
      0.7,
    );
    return { duration, thumb };
  } finally {
    revoke();
  }
}

/**
 * Extracts analysis frames from a clip at 25% and 75% (TRD §3.3), downscaled
 * to ≤768px JPEG, returned as base64 data-URLs.
 */
export async function extractAnalysisFrames(blob: Blob, duration: number): Promise<string[]> {
  const { video, revoke } = await loadVideo(blob);
  try {
    const frames: string[] = [];
    for (const t of [duration * 0.25, duration * 0.75]) {
      const canvas = await seekFrame(video, t);
      frames.push(downscaleCanvas(canvas, 768).toDataURL("image/jpeg", 0.7));
    }
    return frames;
  } finally {
    revoke();
  }
}

/** Downscaled JPEG data-URL of an image asset for the vision model. */
export async function imageToAnalysisFrame(blob: Blob): Promise<string> {
  const bmp = await decodeImage(blob);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 768 / Math.max(bmp.width, bmp.height));
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.7);
}

function downscaleCanvas(source: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  if (scale === 1) return source;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Builds an Asset (with thumbnail + duration) from a validated file. */
export async function fileToAsset(file: File): Promise<Asset> {
  const kind = fileKind(file)!;
  const id = crypto.randomUUID();
  if (kind === "image") {
    return {
      id,
      kind,
      name: file.name,
      blob: file,
      thumb: await makeImageThumb(file),
      analysis: "pending",
    };
  }
  const { duration, thumb } = await probeVideo(file);
  if (duration > limits.maxClipSeconds) {
    throw new Error(`"${file.name}" is ${Math.round(duration)}s — clips must be ≤ ${limits.maxClipSeconds}s`);
  }
  return { id, kind, name: file.name, blob: file, thumb, duration, analysis: "pending" };
}

export function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
