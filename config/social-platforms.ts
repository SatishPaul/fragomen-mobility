import type { FormatId } from "./templates";

export type SocialNetwork =
  | "x"
  | "linkedin"
  | "instagram"
  | "facebook"
  | "threads"
  | "tiktok"
  | "youtube"
  | "pinterest"
  | "google_business"
  | "vimeo"
  | "bluesky";

export interface SocialPlatform {
  id: SocialNetwork;
  label: string;
  recommendedFormats: FormatId[];
  requiresTitle?: boolean;
  publishingEnabled?: boolean;
  note: string;
}

export const socialPlatforms: SocialPlatform[] = [
  { id: "x", label: "X", recommendedFormats: ["16:9", "1:1"], note: "Landscape or square video" },
  { id: "linkedin", label: "LinkedIn", recommendedFormats: ["16:9", "1:1"], note: "Landscape or square feed video" },
  { id: "instagram", label: "Instagram", recommendedFormats: ["9:16", "1:1"], note: "Vertical Reel or square feed video" },
  { id: "facebook", label: "Facebook", recommendedFormats: ["9:16", "16:9", "1:1"], note: "Reel, landscape, or square video" },
  { id: "threads", label: "Threads", recommendedFormats: ["9:16", "1:1"], note: "Vertical or square video" },
  { id: "tiktok", label: "TikTok", recommendedFormats: ["9:16"], note: "Vertical video with privacy and disclosure settings" },
  { id: "youtube", label: "YouTube", recommendedFormats: ["16:9", "9:16"], requiresTitle: true, note: "Landscape video or vertical Short" },
  { id: "pinterest", label: "Pinterest", recommendedFormats: ["9:16", "1:1"], publishingEnabled: false, note: "Board selection is not yet available" },
  { id: "google_business", label: "Google Business", recommendedFormats: ["16:9", "1:1"], note: "Landscape or square business update" },
  { id: "vimeo", label: "Vimeo", recommendedFormats: ["16:9"], requiresTitle: true, note: "Landscape video with title and privacy" },
  { id: "bluesky", label: "Bluesky", recommendedFormats: ["16:9", "1:1"], note: "Already-connected accounts only" },
];

export function platformsForFormat(format: FormatId): SocialPlatform[] {
  return socialPlatforms.filter((platform) => platform.recommendedFormats.includes(format));
}