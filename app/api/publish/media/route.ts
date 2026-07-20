import { NextResponse } from "next/server";
import { createMediaUpload } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { sanitizeMediaFilename } from "@/lib/server/publishing-validation";
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
    const filename = sanitizeMediaFilename(body?.filename);
    if (!filename) throw new Error("The video filename is invalid.");
    return NextResponse.json(await createMediaUpload(filename));
  } catch (error) {
    return publishingError(error);
  }
}