import { NextResponse } from "next/server";
import { createMediaUpload } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { clientIp, throttled } from "@/lib/server/throttle";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    await requirePublishingSession();
    if (throttled(`publish-media:${clientIp(request)}`, 6)) {
      throw new Error("Too many media upload attempts. Wait a minute and try again.");
    }
    const body = (await request.json().catch(() => null)) as { filename?: string } | null;
    const baseName = body?.filename?.replace(/\.mp4$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120);
    if (!baseName) throw new Error("The video filename is invalid.");
    return NextResponse.json(await createMediaUpload(`${baseName}.mp4`));
  } catch (error) {
    return publishingError(error);
  }
}