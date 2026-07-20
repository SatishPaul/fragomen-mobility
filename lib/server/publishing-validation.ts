const defaultSocialVideoMaxBytes = 500 * 1024 * 1024;

export function validProviderId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export function socialVideoMaxBytes(configuredValue = process.env.SOCIAL_VIDEO_MAX_BYTES): number {
  const configured = Number(configuredValue);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : defaultSocialVideoMaxBytes;
}

export function sanitizeMediaFilename(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const baseName = value
    .replace(/\.mp4$/i, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 120);
  return baseName ? `${baseName}.mp4` : null;
}

export function validVideoSize(value: unknown, maximum = socialVideoMaxBytes()): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= maximum;
}