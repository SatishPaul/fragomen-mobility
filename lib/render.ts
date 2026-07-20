"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { brand } from "@/config/brand";
import {
  formats,
  limits,
  styles,
  type FormatId,
  type KenBurnsMove,
  type StyleId,
} from "@/config/templates";
import { buildMasterTrack, type ClipAudioPlacement, type MusicBed, type VoicePlacement } from "./audio";
import { decodeImage, canvasToBlob, isMobile } from "./media";
import { decodeMusicFile, generateMusicBed, getCustomTrack } from "./music";
import { getSceneAudio, sceneDurationFor } from "./tts";
import type { Asset, MusicSettings, Scene } from "./types";

/**
 * In-browser render pipeline (TRD §3.2). One scene is encoded at a time and
 * intermediates are deleted from MEMFS immediately — that is what keeps
 * long multi-asset renders feasible in a browser tab.
 *
 * Look: Ken Burns motion on stills (canvas-generated frames — the WASM
 * zoompan filter deadlocks), blurred-fill framing for aspect mismatches,
 * eased crossfade transitions between scenes, and burned-in subtitles.
 */

// 24 fps reads identically for slideshow-style motion and cuts render work
// by a fifth versus 30.
const FPS = 24;
// -threads 4: uncapped x264 threading can exhaust the WASM pthread pool and
// deadlock the multithreaded core in some browsers.
const ENCODE = [
  "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
  "-pix_fmt", "yuv420p", "-threads", "4",
];

let ffmpegPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        if (process.env.NODE_ENV === "development") console.log("[ffmpeg]", message);
      });
      const base = "/ffmpeg";
      await ffmpeg.load({
        coreURL: `${base}/ffmpeg-core.js`,
        wasmURL: `${base}/ffmpeg-core.wasm`,
        workerURL: `${base}/ffmpeg-core.worker.js`,
      });
      return ffmpeg;
    })();
    ffmpegPromise.catch(() => (ffmpegPromise = null));
  }
  return ffmpegPromise;
}

declare global {
  interface Window {
    __ffmpegExec?: (args: string[]) => Promise<{ rc: number; ms: number }>;
  }
}
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.__ffmpegExec = async (args: string[]) => {
    const f = await getFFmpeg();
    const t0 = performance.now();
    const rc = await f.exec(args);
    return { rc, ms: Math.round(performance.now() - t0) };
  };
}

interface ScenePlan {
  asset: Asset;
  scene: Scene;
  /** Quantized to whole frames so audio offsets never drift. */
  frames: number;
  duration: number;
  /** Scene content start in the final timeline (transitions included). */
  offset: number;
  move: KenBurnsMove;
}

export interface RenderInput {
  assets: Asset[];
  scenes: Scene[];
  format: FormatId;
  style: StyleId;
  music: MusicSettings;
  /** AI-written opening/closing card text (empty strings = no cards). */
  cards?: { title: string; subtitle: string; outro: string; outroSub: string };
  onProgress: (progress: number, label: string) => void;
}

export interface RenderOutput {
  blob: Blob;
  url: string;
  fileName: string;
  width: number;
  height: number;
  seconds: number;
}

export async function renderVideo(input: RenderInput): Promise<RenderOutput> {
  const { assets, scenes, onProgress } = input;
  const format = formats.find((f) => f.id === input.format)!;
  const style = styles.find((s) => s.id === input.style)!;
  const mobile = isMobile();
  const W = mobile ? format.mobileWidth : format.width;
  const H = mobile ? format.mobileHeight : format.height;

  // ---- Plan scenes (frame-quantized durations → stable offsets) ----------
  const introText = input.cards?.title?.trim() ?? "";
  const outroText = input.cards?.outro?.trim() ?? "";
  const introSeconds = introText ? 3 : 0;
  const outroSeconds = outroText ? limits.outroSeconds : 0;
  const transFrames = Math.round(style.transitionSeconds * FPS);
  const transDuration = transFrames / FPS;
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const active = scenes.filter((s) => assetById.has(s.assetId));
  const plan: ScenePlan[] = [];
  let cursor = introSeconds;
  let imageIndex = 0;
  for (const scene of active) {
    const asset = assetById.get(scene.assetId)!;
    const audio = getSceneAudio(scene.assetId);
    const raw = sceneDurationFor(asset.kind, audio?.duration);
    const frames = Math.max(FPS, Math.round(raw * FPS));
    if (plan.length > 0) cursor += transDuration;
    plan.push({
      asset,
      scene,
      frames,
      duration: frames / FPS,
      offset: cursor,
      move: style.kenBurns[imageIndex % style.kenBurns.length],
    });
    if (asset.kind === "image") imageIndex++;
    cursor += frames / FPS;
  }
  if (plan.length === 0) throw new Error("Nothing to render — add media first.");

  const total = cursor + outroSeconds;
  if (total > limits.maxOutputSeconds + 0.5) {
    throw new Error(
      `This project is ${Math.round(total)}s — the limit is ${limits.maxOutputSeconds}s. Shorten some narration lines or remove assets.`,
    );
  }

  const transitions = plan.length - 1;
  const cardCount = (introSeconds ? 1 : 0) + (outroSeconds ? 1 : 0);
  const steps = plan.length + transitions + cardCount + 3; // scenes + transitions + cards + audio + concat + mux
  let step = 0;
  const tick = (label: string) => onProgress(Math.min(0.99, step++ / steps), label);

  tick("Warming up the encoder…");
  const ffmpeg = await getFFmpeg();

  // ---- Opening title card --------------------------------------------------
  if (introSeconds > 0) {
    tick("Painting the opening title…");
    await encodeCard(ffmpeg, {
      main: introText,
      kicker: (input.cards?.subtitle ?? "").toUpperCase(),
      sub: "",
      seconds: introSeconds,
      W,
      H,
      colors: style.swatch,
      out: "card_intro.mp4",
    });
  }

  // ---- Encode each scene, keeping edge frames for the transitions ---------
  const segments: string[] = [];
  const firstFrames: (ImageBitmap | null)[] = [];
  const lastFrames: (ImageBitmap | null)[] = [];
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    tick(`Rendering scene ${i + 1} of ${plan.length}…`);
    const out = `scene_${i}.mp4`;
    const subtitle = style.subtitles ? p.scene.line.trim() : "";
    let edges: SceneEdges;
    if (p.asset.kind === "image") {
      edges = await encodeImageScene(ffmpeg, p, W, H, style.zoomAmount, subtitle, out);
    } else {
      edges = await encodeVideoScene(ffmpeg, p, W, H, subtitle, out);
    }
    segments.push(out);
    firstFrames.push(edges.first);
    lastFrames.push(edges.last);
  }

  // ---- Transition segments (eased crossfade with zoom drift) --------------
  const timeline: string[] = introSeconds > 0 ? ["card_intro.mp4"] : [];
  for (let i = 0; i < plan.length; i++) {
    if (i > 0) {
      tick(`Blending transition ${i} of ${transitions}…`);
      const name = `trans_${i}.mp4`;
      const a = lastFrames[i - 1];
      const b = firstFrames[i];
      if (a && b && transFrames > 0) {
        await encodeTransition(ffmpeg, a, b, transFrames, W, H, name);
        timeline.push(name);
      }
    }
    timeline.push(segments[i]);
  }
  for (const frame of [...firstFrames, ...lastFrames]) frame?.close();

  // ---- Closing card --------------------------------------------------------
  if (outroSeconds > 0) {
    tick("Painting the closing card…");
    await encodeCard(ffmpeg, {
      main: outroText,
      kicker: "",
      sub: input.cards?.outroSub ?? "",
      seconds: outroSeconds,
      W,
      H,
      colors: style.swatch,
      out: "card_outro.mp4",
    });
    timeline.push("card_outro.mp4");
  }

  // ---- Master audio track -------------------------------------------------
  tick("Mixing the voiceover track…");
  const voices: VoicePlacement[] = [];
  const clipAudio: ClipAudioPlacement[] = [];
  for (const p of plan) {
    const audio = getSceneAudio(p.scene.assetId);
    if (audio) {
      voices.push({ data: audio.data, sampleRate: audio.sampleRate, offset: p.offset });
    }
    if (p.asset.kind === "video" && style.clipAudioLevel > 0) {
      clipAudio.push({
        blob: p.asset.blob,
        offset: p.offset,
        duration: Math.min(p.asset.duration ?? p.duration, p.duration),
        gain: style.clipAudioLevel,
      });
    }
  }
  let musicBed: MusicBed | null = null;
  if (input.music.mode !== "none" && input.music.volume > 0) {
    try {
      const buffer =
        input.music.mode === "custom" && getCustomTrack()
          ? await decodeMusicFile(getCustomTrack()!)
          : await generateMusicBed(Math.min(total, 60), input.music.mood);
      musicBed = { buffer, volume: input.music.volume, duckTo: 0.5 };
    } catch {
      // Bad music file — render without it rather than failing the video.
    }
  }
  const wav = await buildMasterTrack(total, voices, clipAudio, musicBed);
  await ffmpeg.writeFile("audio.wav", new Uint8Array(await wav.arrayBuffer()));

  // ---- Concat + mux -------------------------------------------------------
  tick("Joining scenes…");
  const list = timeline.map((n) => `file '${n}'`).join("\n");
  await ffmpeg.writeFile("list.txt", new TextEncoder().encode(list));
  await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "concat.mp4"]);
  for (const n of timeline) await ffmpeg.deleteFile(n).catch(() => {});
  await ffmpeg.deleteFile("list.txt").catch(() => {});

  tick("Muxing audio…");
  await ffmpeg.exec([
    "-i", "concat.mp4", "-i", "audio.wav",
    "-map", "0:v", "-map", "1:a",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
    "-shortest", "-movflags", "+faststart",
    "out.mp4",
  ]);

  const data = (await ffmpeg.readFile("out.mp4")) as Uint8Array;
  for (const n of ["concat.mp4", "audio.wav", "out.mp4"]) {
    await ffmpeg.deleteFile(n).catch(() => {});
  }

  const blob = new Blob([data.slice().buffer as ArrayBuffer], { type: "video/mp4" });
  const fileName = `${brand.name.toLowerCase()}-${input.format.replace(":", "x")}-${Date.now()}.mp4`;
  onProgress(1, "Done");
  return {
    blob,
    url: URL.createObjectURL(blob),
    fileName,
    width: W,
    height: H,
    seconds: Math.round(total),
  };
}

// ---------------------------------------------------------------------------

interface SceneEdges {
  first: ImageBitmap | null;
  last: ImageBitmap | null;
}

/**
 * Composes the source onto a W:H "stage" ready for Ken Burns sampling.
 * Aspect-matched sources cover the frame; mismatched ones (e.g. landscape
 * photos in a 9:16 reel) sit sharp and complete over a blurred fill — no
 * brutal cropping.
 */
function composeStage(
  source: ImageBitmap | HTMLCanvasElement | HTMLVideoElement,
  sw: number,
  sh: number,
  W: number,
  H: number,
): HTMLCanvasElement {
  // Headroom above the target size so the Ken Burns zoom never upscales.
  const scale = Math.min(1.35, Math.sqrt(4_600_000 / (W * H)));
  const stageW = Math.round(W * scale);
  const stageH = Math.round(H * scale);
  const stage = document.createElement("canvas");
  stage.width = stageW;
  stage.height = stageH;
  const ctx = stage.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  const srcAspect = sw / sh;
  const dstAspect = W / H;
  const mismatch = Math.max(srcAspect / dstAspect, dstAspect / srcAspect);

  if (mismatch <= 1.2) {
    // Close enough — classic cover crop.
    const s = Math.max(stageW / sw, stageH / sh);
    ctx.drawImage(source, (stageW - sw * s) / 2, (stageH - sh * s) / 2, sw * s, sh * s);
  } else {
    // Blurred cover fill behind a sharp, complete foreground.
    const bg = Math.max(stageW / sw, stageH / sh);
    ctx.filter = `blur(${Math.round(stageW / 32)}px)`;
    ctx.drawImage(source, (stageW - sw * bg) / 2, (stageH - sh * bg) / 2, sw * bg, sh * bg);
    ctx.filter = "none";
    // Slightly darken the fill so the foreground pops.
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(0, 0, stageW, stageH);
    const fg = Math.min(stageW / sw, stageH / sh) * 0.94;
    const fw = sw * fg;
    const fh = sh * fg;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = stageW / 40;
    ctx.drawImage(source, (stageW - fw) / 2, (stageH - fh) / 2, fw, fh);
    ctx.restore();
  }
  return stage;
}

/** Subtitle layout, wrapped and measured once per scene. */
interface SubtitleBlock {
  lines: string[];
  fontPx: number;
  lineHeight: number;
  /** Baseline Y of the first line. */
  firstBaseline: number;
  padX: number;
  padY: number;
  radius: number;
}

function layoutSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  W: number,
  H: number,
): SubtitleBlock | null {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  const fontPx = Math.round(Math.min(W, H) * 0.042);
  const lineHeight = Math.round(fontPx * 1.35);
  ctx.font = `600 ${fontPx}px ${getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"}`;
  const maxWidth = W * 0.84;

  const words = clean.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, 3);

  const blockHeight = shown.length * lineHeight;
  const bottomMargin = Math.round(H * 0.07);
  return {
    lines: shown,
    fontPx,
    lineHeight,
    firstBaseline: H - bottomMargin - blockHeight + lineHeight - Math.round(fontPx * 0.28),
    padX: Math.round(fontPx * 0.75),
    padY: Math.round(fontPx * 0.45),
    radius: Math.round(fontPx * 0.5),
  };
}

function drawSubtitle(ctx: CanvasRenderingContext2D, sub: SubtitleBlock, W: number) {
  ctx.save();
  ctx.font = `600 ${sub.fontPx}px ${getComputedStyle(document.body).fontFamily || "system-ui, sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  sub.lines.forEach((line, i) => {
    const y = sub.firstBaseline + i * sub.lineHeight;
    const w = ctx.measureText(line).width;
    const boxX = W / 2 - w / 2 - sub.padX;
    const boxY = y - sub.fontPx - sub.padY + Math.round(sub.fontPx * 0.2);
    const boxW = w + sub.padX * 2;
    const boxH = sub.fontPx + sub.padY * 2;
    ctx.fillStyle = "rgba(8, 11, 20, 0.62)";
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, sub.radius);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.fillText(line, W / 2, y);
  });
  ctx.restore();
}

/** Encodes canvas frames already written as f_%04d.jpg into an mp4 segment. */
async function encodeFrameSequence(
  ffmpeg: FFmpeg,
  count: number,
  out: string,
): Promise<void> {
  await ffmpeg.exec(["-framerate", String(FPS), "-i", "f_%04d.jpg", ...ENCODE, "-an", out]);
  for (let k = 0; k < count; k++) {
    await ffmpeg.deleteFile(`f_${String(k).padStart(4, "0")}.jpg`).catch(() => {});
  }
}

async function writeFrame(ffmpeg: FFmpeg, canvas: HTMLCanvasElement, k: number, quality = 0.8) {
  const jpeg = await canvasToBlob(canvas, quality);
  await ffmpeg.writeFile(
    `f_${String(k).padStart(4, "0")}.jpg`,
    new Uint8Array(await jpeg.arrayBuffer()),
  );
}

/** Ken Burns over a composed stage, with subtitles, plus edge frames. */
async function encodeImageScene(
  ffmpeg: FFmpeg,
  p: ScenePlan,
  W: number,
  H: number,
  zoomAmount: number,
  subtitle: string,
  out: string,
): Promise<SceneEdges> {
  const bmp = await decodeImage(p.asset.blob);
  const stage = composeStage(bmp, bmp.width, bmp.height, W, H);
  bmp.close();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const sub = subtitle ? layoutSubtitle(ctx, subtitle, W, H) : null;

  const frames = p.frames;
  let first: ImageBitmap | null = null;
  let last: ImageBitmap | null = null;
  for (let k = 0; k < frames; k++) {
    const t = frames === 1 ? 0 : k / (frames - 1);
    const e = t * t * (3 - 2 * t); // smoothstep
    let zoom = 1;
    let panX = 0.5;
    if (p.move === "zoom-in") zoom = 1 + zoomAmount * e;
    else if (p.move === "zoom-out") zoom = 1 + zoomAmount * (1 - e);
    else {
      zoom = 1 + zoomAmount;
      panX = p.move === "pan-left" ? 1 - e : e;
    }
    // Viewport in stage coordinates (stage shares the target aspect ratio).
    const vw = stage.width / zoom;
    const vh = stage.height / zoom;
    const sx = (stage.width - vw) * panX;
    const sy = (stage.height - vh) / 2;
    ctx.drawImage(stage, sx, sy, vw, vh, 0, 0, W, H);
    if (sub) drawSubtitle(ctx, sub, W);
    if (k === 0) first = await createImageBitmap(canvas);
    if (k === frames - 1) last = await createImageBitmap(canvas);
    await writeFrame(ffmpeg, canvas, k);
  }
  await encodeFrameSequence(ffmpeg, frames, out);
  return { first, last };
}

/**
 * Video scenes are re-rendered through the same canvas path: frames are
 * pulled from a seeking <video>, composed on the stage (blur-fill for aspect
 * mismatch) with subtitles. Slower than a pure ffmpeg filter chain but keeps
 * one consistent look and avoids WASM filter instability.
 */
async function encodeVideoScene(
  ffmpeg: FFmpeg,
  p: ScenePlan,
  W: number,
  H: number,
  subtitle: string,
  out: string,
): Promise<SceneEdges> {
  const url = URL.createObjectURL(p.asset.blob);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error(`Could not decode "${p.asset.name}"`));
  });

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const sub = subtitle ? layoutSubtitle(ctx, subtitle, W, H) : null;

  const clipDur = Math.max(0.1, video.duration || p.duration);
  const frames = p.frames;
  let first: ImageBitmap | null = null;
  let last: ImageBitmap | null = null;

  const seek = (time: number) =>
    new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Seek failed"));
      video.currentTime = Math.min(time, clipDur - 0.001);
    });

  // Precompute framing once — blurring every frame would be far too slow.
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const mismatch = Math.max(vw / vh / (W / H), W / H / (vw / vh));
  let bg: HTMLCanvasElement | null = null;
  let fgRect: [number, number, number, number];
  if (mismatch <= 1.2) {
    const s = Math.max(W / vw, H / vh);
    fgRect = [(W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s];
  } else {
    const s = Math.min(W / vw, H / vh) * 0.94;
    fgRect = [(W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s];
  }

  try {
    for (let k = 0; k < frames; k++) {
      // Freeze on the last clip frame if narration outlasts the clip.
      await seek(Math.min(k / FPS, clipDur - 0.001));
      if (mismatch > 1.2 && !bg) {
        // Static blurred fill, rendered once from the first frame.
        bg = document.createElement("canvas");
        bg.width = W;
        bg.height = H;
        const bctx = bg.getContext("2d")!;
        const cover = Math.max(W / vw, H / vh);
        bctx.filter = `blur(${Math.round(W / 32)}px)`;
        bctx.drawImage(video, (W - vw * cover) / 2, (H - vh * cover) / 2, vw * cover, vh * cover);
        bctx.filter = "none";
        bctx.fillStyle = "rgba(0,0,0,0.28)";
        bctx.fillRect(0, 0, W, H);
      }
      if (bg) ctx.drawImage(bg, 0, 0);
      ctx.drawImage(video, ...fgRect);
      if (sub) drawSubtitle(ctx, sub, W);
      if (k === 0) first = await createImageBitmap(canvas);
      if (k === frames - 1) last = await createImageBitmap(canvas);
      await writeFrame(ffmpeg, canvas, k);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
  await encodeFrameSequence(ffmpeg, frames, out);
  return { first, last };
}

/** Eased crossfade with a gentle zoom drift between two edge frames. */
async function encodeTransition(
  ffmpeg: FFmpeg,
  a: ImageBitmap,
  b: ImageBitmap,
  frames: number,
  W: number,
  H: number,
  out: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  for (let k = 0; k < frames; k++) {
    const t = frames === 1 ? 1 : k / (frames - 1);
    const e = t * t * (3 - 2 * t);
    // Outgoing drifts slightly forward, incoming settles from slightly wide.
    const za = 1 + 0.05 * e;
    const zb = 1.05 - 0.05 * e;
    ctx.globalAlpha = 1;
    drawZoomed(ctx, a, za, W, H);
    ctx.globalAlpha = e;
    drawZoomed(ctx, b, zb, W, H);
    ctx.globalAlpha = 1;
    await writeFrame(ffmpeg, canvas, k, 0.85);
  }
  await encodeFrameSequence(ffmpeg, frames, out);
}

function drawZoomed(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  zoom: number,
  W: number,
  H: number,
) {
  const w = W * zoom;
  const h = H * zoom;
  ctx.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
}

// ---------------------------------------------------------------------------
// Title cards

interface CardSpec {
  /** Headline (AI-written title or closing line). */
  main: string;
  /** Small letter-spaced line above the headline (e.g. the brand name). */
  kicker: string;
  /** Small line below the headline (e.g. the contact line). */
  sub: string;
  seconds: number;
  W: number;
  H: number;
  /** Style swatch — drives the glow and the headline gradient. */
  colors: readonly [string, string];
  out: string;
}

/**
 * An art-directed opening/closing card: near-black backdrop with two color
 * glows drifting in the style's palette, a letter-spaced kicker between
 * hairlines that draw outward, and the headline revealed letter by letter in
 * a gradient fill with a soft glow. Fades from and to black so the cut into
 * content reads as intentional cinema rather than a slide change.
 */
async function encodeCard(ffmpeg: FFmpeg, spec: CardSpec): Promise<void> {
  const { W, H, colors, seconds } = spec;
  const frames = Math.max(FPS, Math.round(seconds * FPS));
  const family =
    getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  // ---- Measure the headline once: wrapped lines → per-glyph slots ---------
  const fontPx = Math.round(Math.min(W, H) * (spec.main.length > 40 ? 0.055 : 0.07));
  const lineHeight = Math.round(fontPx * 1.3);
  ctx.font = `800 ${fontPx}px ${family}`;
  const words = spec.main.replace(/\s+/g, " ").trim().split(" ");
  const maxWidth = W * 0.8;
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(cand).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = cand;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3);
  const glyphs: { ch: string; x: number; y: number }[] = [];
  const blockTop = H * 0.5 - (shown.length * lineHeight) / 2;
  shown.forEach((line, li) => {
    let x = W / 2 - ctx.measureText(line).width / 2;
    const y = blockTop + li * lineHeight + lineHeight / 2;
    for (const ch of line) {
      glyphs.push({ ch, x, y });
      x += ctx.measureText(ch).width;
    }
  });

  const smooth = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    return c * c * (3 - 2 * c);
  };

  for (let k = 0; k < frames; k++) {
    const t = k / FPS;
    const tn = frames === 1  ? 1 : k / (frames - 1);

    // Backdrop: deep gradient with two glows drifting through the palette.
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#080b14");
    bg.addColorStop(1, "#111828");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const ax = W * (0.25 + 0.15 * Math.sin(tn * Math.PI));
    const glowA = ctx.createRadialGradient(ax, H * 0.3, 0, ax, H * 0.3, W * 0.5);
    glowA.addColorStop(0, rgba(colors[0], 0.26));
    glowA.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowA;
    ctx.fillRect(0, 0, W, H);
    const bx = W * (0.78 - 0.12 * Math.sin(tn * Math.PI));
    const glowB = ctx.createRadialGradient(bx, H * 0.75, 0, bx, H * 0.75, W * 0.55);
    glowB.addColorStop(0, rgba(colors[1], 0.2));
    glowB.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowB;
    ctx.fillRect(0, 0, W, H);

    // Everything typographic drifts on a slow 4% zoom.
    ctx.save();
    const drift = 1 + 0.04 * smooth(tn);
    ctx.translate(W / 2, H / 2);
    ctx.scale(drift, drift);
    ctx.translate(-W / 2, -H / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Kicker between hairlines that draw outward from the center. The AI
    // subtitle can be long — shrink the type until it fits the frame.
    if (spec.kicker) {
      let kickerPx = Math.round(fontPx * 0.28);
      let spacing = kickerPx * 0.5;
      ctx.font = `500 ${kickerPx}px ${family}`;
      const measure = () =>
        [...spec.kicker].reduce((w, ch) => w + ctx.measureText(ch).width + spacing, 0) -
        spacing;
      while (measure() > W * 0.72 && kickerPx > 10) {
        kickerPx = Math.round(kickerPx * 0.9);
        spacing = kickerPx * 0.5;
        ctx.font = `500 ${kickerPx}px ${family}`;
      }
      const kickerW = measure();
      const ky = blockTop - lineHeight * 0.7;
      const ka = smooth((t - 0.15) / 0.6);
      ctx.globalAlpha = ka;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      let kx = W / 2 - kickerW / 2;
      for (const ch of spec.kicker) {
        ctx.fillText(ch, kx, ky);
        kx += ctx.measureText(ch).width + spacing;
      }
      const ruleW = W * 0.1 * ka;
      ctx.strokeStyle = rgba(colors[0], 0.8);
      ctx.lineWidth = Math.max(1, Math.round(H / 540));
      ctx.beginPath();
      ctx.moveTo(W / 2 - kickerW / 2 - kickerPx - ruleW, ky);
      ctx.lineTo(W / 2 - kickerW / 2 - kickerPx, ky);
      ctx.moveTo(W / 2 + kickerW / 2 + kickerPx, ky);
      ctx.lineTo(W / 2 + kickerW / 2 + kickerPx + ruleW, ky);
      ctx.stroke();
    }

    // Headline: gradient fill, glow, staggered letter-by-letter reveal.
    ctx.font = `800 ${fontPx}px ${family}`;
    const grad = ctx.createLinearGradient(W * 0.1, 0, W * 0.9, 0);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, "#ffe3a3");
    grad.addColorStop(1, colors[1]);
    for (let g = 0; g < glyphs.length; g++) {
      const start = 0.35 + (g / Math.max(1, glyphs.length - 1)) * 0.9;
      const a = smooth((t - start) / 0.4);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.shadowColor = rgba(colors[0], 0.55 * a);
      ctx.shadowBlur = fontPx * 0.45;
      ctx.fillStyle = grad;
      ctx.fillText(glyphs[g].ch, glyphs[g].x, glyphs[g].y + (1 - a) * fontPx * 0.35);
    }
    ctx.shadowBlur = 0;

    // Sub line (e.g. contact) settles in last.
    if (spec.sub) {
      const sa = smooth((t - 1.0) / 0.6);
      ctx.globalAlpha = sa;
      ctx.textAlign = "center";
      ctx.font = `400 ${Math.round(fontPx * 0.3)}px ${family}`;
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(
        spec.sub,
        W / 2,
        blockTop + shown.length * lineHeight + fontPx * 0.7,
      );
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Cinematic fade from and to black.
    const fade =
      Math.max(0, 1 - smooth(t / 0.35)) +
      smooth((t - (seconds - 0.55)) / 0.55);
    if (fade > 0.001) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, fade)})`;
      ctx.fillRect(0, 0, W, H);
    }

    await writeFrame(ffmpeg, canvas, k, 0.8);
  }
  await encodeFrameSequence(ffmpeg, frames, spec.out);
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
