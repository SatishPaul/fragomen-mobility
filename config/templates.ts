/**
 * Output formats and style templates. Styles are pure config — Ken Burns
 * motion, watermark placement, outro card, and script tone all live here so
 * new styles can be added without touching the render pipeline.
 */

export type FormatId = "16:9" | "9:16" | "1:1";

export interface Format {
  id: FormatId;
  label: string;
  detail: string;
  width: number;
  height: number;
  /** Dimensions used on mobile devices (720p cap per PRD F7). */
  mobileWidth: number;
  mobileHeight: number;
}

export const formats: Format[] = [
  {
    id: "16:9",
    label: "YouTube",
    detail: "16:9 · 1920×1080",
    width: 1920,
    height: 1080,
    mobileWidth: 1280,
    mobileHeight: 720,
  },
  {
    id: "9:16",
    label: "Shorts / Reels / TikTok",
    detail: "9:16 · 1080×1920",
    width: 1080,
    height: 1920,
    mobileWidth: 720,
    mobileHeight: 1280,
  },
  {
    id: "1:1",
    label: "Square",
    detail: "1:1 · 1080×1080",
    width: 1080,
    height: 1080,
    mobileWidth: 720,
    mobileHeight: 720,
  },
];

export type KenBurnsMove =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right";

export type StyleId = "clean" | "realestate" | "bold";

export interface StyleTemplate {
  id: StyleId;
  label: string;
  detail: string;
  /** Tone hint passed to the script LLM. */
  tone: string;
  /** Ken Burns moves cycled across image scenes. */
  kenBurns: KenBurnsMove[];
  /** Ken Burns zoom amount (0.08 = 8% over the scene). */
  zoomAmount: number;
  /** Watermark corner, or null for no watermark. */
  watermark: "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
  /** Watermark width as a fraction of the video width. */
  watermarkScale: number;
  /** Append a branded outro card with the contact line from config/brand.ts. */
  outroCard: boolean;
  /** Original clip audio level under the voiceover (0 = mute, 0.2 = 20%). */
  clipAudioLevel: number;
  /** Crossfade length between scenes, in seconds (0 = hard cuts). */
  transitionSeconds: number;
  /** Burn narration subtitles into the video. */
  subtitles: boolean;
  /** Swatch shown on the style picker card. */
  swatch: [string, string];
}

export const styles: StyleTemplate[] = [
  {
    id: "clean",
    label: "Clean",
    detail: "Understated motion, soft crossfades, subtitles. Lets the footage speak.",
    tone: "clean, modern and understated",
    kenBurns: ["zoom-in", "pan-right", "zoom-out", "pan-left"],
    zoomAmount: 0.06,
    watermark: null,
    watermarkScale: 0.14,
    outroCard: false,
    clipAudioLevel: 0.2,
    transitionSeconds: 0.5,
    subtitles: true,
    swatch: ["#38bdf8", "#0ea5e9"],
  },
  {
    id: "realestate",
    label: "Real Estate",
    detail: "Warm, inviting listing tour with cinematic crossfades and subtitles.",
    tone: "warm, inviting, visual-first, like a property walkthrough",
    kenBurns: ["zoom-in", "pan-left", "zoom-in", "pan-right"],
    zoomAmount: 0.09,
    watermark: null,
    watermarkScale: 0.16,
    outroCard: false,
    clipAudioLevel: 0.2,
    transitionSeconds: 0.55,
    subtitles: true,
    swatch: ["#e08a4c", "#b4592a"],
  },
  {
    id: "bold",
    label: "Bold",
    detail: "Punchy zooms, fast crossfades and high energy for attention-grabbing shorts.",
    tone: "punchy, energetic and confident",
    kenBurns: ["zoom-in", "zoom-in", "zoom-out", "zoom-in"],
    zoomAmount: 0.14,
    watermark: null,
    watermarkScale: 0.14,
    outroCard: false,
    clipAudioLevel: 0,
    transitionSeconds: 0.35,
    subtitles: true,
    swatch: ["#c084fc", "#7c3aed"],
  },
];

/** Hard caps from the PRD — enforced in the UI, not just documented. */
export const limits = {
  maxAssets: 20,
  maxImageBytes: 15 * 1024 * 1024,
  maxVideoBytes: 200 * 1024 * 1024,
  maxClipSeconds: 60,
  /**
   * 600 s = 10 min. The in-browser encoder holds every scene segment in WASM
   * memory until the final concat, so very long 1080p renders are memory-
   * hungry — the mobile dimension fallback in render.ts keeps phones viable.
   */
  maxOutputSeconds: 600,
  /** Scene padding after narration ends (TRD §3.2). */
  scenePaddingSeconds: 0.4,
  /** Minimum scene length for images without narration. */
  minImageSceneSeconds: 2.5,
  /** Outro card length. */
  outroSeconds: 3,
} as const;
