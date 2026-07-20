import "server-only";

import { del, head, list } from "@vercel/blob";

export const socialStagingPrefix = "social-staging/";
export const defaultSocialVideoMaxBytes = 500 * 1024 * 1024;
export const socialStagingMaxAgeMs = 24 * 60 * 60 * 1000;

export interface StagedVideo {
  url: string;
  pathname: string;
  contentType: string;
  contentLength: number;
  etag: string;
  uploadedAt: Date;
}

export function socialVideoMaxBytes(): number {
  const configured = Number(process.env.SOCIAL_VIDEO_MAX_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : defaultSocialVideoMaxBytes;
}

function configuredBlobHostname(): string {
  const storeId = process.env.BLOB_STORE_ID?.trim();
  if (!storeId || !/^[a-zA-Z0-9_-]+$/.test(storeId)) {
    throw new Error("Social publishing requires BLOB_STORE_ID to be configured.");
  }
  return `${storeId.replace(/^store_/, "")}.public.blob.vercel-storage.com`;
}

export function requireStagedBlobUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The staged video URL is invalid.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== configuredBlobHostname() ||
    !url.pathname.slice(1).startsWith(socialStagingPrefix)
  ) {
    throw new Error("The video is not in the configured social staging store.");
  }
  return url;
}

export async function getStagedVideo(value: string): Promise<StagedVideo> {
  const url = requireStagedBlobUrl(value);
  const metadata = await head(url.href);
  if (
    metadata.pathname !== url.pathname.slice(1) ||
    metadata.contentType !== "video/mp4" ||
    metadata.size > socialVideoMaxBytes()
  ) {
    throw new Error("The staged video metadata is not valid for publishing.");
  }

  return {
    url: metadata.url,
    pathname: metadata.pathname,
    contentType: metadata.contentType,
    contentLength: metadata.size,
    etag: metadata.etag,
    uploadedAt: metadata.uploadedAt,
  };
}

export async function deleteStagedVideo(value: string): Promise<void> {
  await del(requireStagedBlobUrl(value).href);
}

export async function deleteExpiredStagedVideos(now = Date.now()): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;

  do {
    const page = await list({ prefix: socialStagingPrefix, cursor, limit: 1000 });
    const expiredUrls = page.blobs
      .filter((blob) => now - blob.uploadedAt.getTime() >= socialStagingMaxAgeMs)
      .map((blob) => blob.url);
    if (expiredUrls.length > 0) {
      await del(expiredUrls);
      deleted += expiredUrls.length;
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return deleted;
}