import type { FormatId, StyleId } from "@/config/templates";
import type { SocialNetwork } from "@/config/social-platforms";

export type AssetKind = "image" | "video";

export type AnalysisStatus = "pending" | "analyzing" | "done" | "error";

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  /** Original file. Never leaves the device (only downscaled frames do). */
  blob: Blob;
  /** Small JPEG data-URL for the tile grid. */
  thumb: string;
  /** Natural clip length in seconds (video only). */
  duration?: number;
  /** Vision-model caption; feeds the script step. */
  caption?: string;
  analysis: AnalysisStatus;
}

export interface Scene {
  assetId: string;
  /** Narration line (editable by the user). */
  line: string;
  /** Voiceover length in seconds once generated. */
  audioDuration?: number;
  /** True while TTS for this scene runs. */
  generating?: boolean;
}

export type WizardStep = "upload" | "format" | "script" | "voice" | "render" | "publish";

export interface RenderState {
  status: "idle" | "rendering" | "done" | "error";
  /** 0..1 across the whole render. */
  progress: number;
  /** What the pipeline is currently doing, for the progress card. */
  label: string;
  /** Object URL of the finished MP4. */
  url?: string;
  fileName?: string;
  error?: string;
}

export interface SocialAccount {
  id: string;
  network: SocialNetwork;
  nickname: string;
  username: string;
  profilePictureUrl?: string;
  active: boolean;
  healthy?: boolean;
}

export interface PublishState {
  status: "idle" | "loading-accounts" | "ready" | "uploading" | "publishing" | "pending" | "complete" | "error";
  accounts: SocialAccount[];
  selectedAccountIds: string[];
  caption: string;
  title: string;
  uploadProgress: number;
  error?: string;
}

export type MusicMode = "none" | "ambient" | "custom";

export interface MusicSettings {
  mode: MusicMode;
  /** Base music loudness (0..0.4 of full scale). */
  volume: number;
  /** Built-in bed mood (ambient mode) — see musicMoods in lib/music.ts. */
  mood?: string;
  /** Display name of the uploaded track (custom mode). */
  trackName?: string;
}

/** AI-written on-screen text for the opening and closing title cards. */
export interface TitleCards {
  /** Opening title (empty = no intro card). */
  title: string;
  /** Informative line shown with the title (subject, place, key facts). */
  subtitle: string;
  /** Closing line / call to action (empty = no outro card). */
  outro: string;
  /** Informative supporting line under the closing (key detail, next step). */
  outroSub: string;
}

export interface ProjectState {
  assets: Asset[];
  format: FormatId;
  style: StyleId;
  /** Optional user context, e.g. "3BHK in Salt Lake, highlight the balcony". */
  context: string;
  scenes: Scene[];
  cards: TitleCards;
  scriptStatus: "empty" | "generating" | "ready" | "error";
  voice: string;
  music: MusicSettings;
  render: RenderState;
  publish: PublishState;
}
