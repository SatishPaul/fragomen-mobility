import { NextResponse } from "next/server";
import { socialVideoMaxBytes } from "@/lib/server/blob-staging";
import { confirmMediaUpload } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError, validProviderId } from "@/lib/server/publishing-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    await requirePublishingSession();
    const body = (await request.json().catch(() => null)) as { id?: string; size?: number } | null;
    if (!validProviderId(body?.id)) throw new Error("The media ID is invalid.");
    if (!Number.isSafeInteger(body?.size) || body!.size! <= 0 || body!.size! > socialVideoMaxBytes()) {
      throw new Error("The video size is invalid.");
    }
    const media = await confirmMediaUpload(body.id, body.size!);
    if (media.status !== "active" || media.content_type !== "video/mp4") {
      throw new Error("Outstand did not confirm an active MP4 upload.");
    }
    return NextResponse.json({ id: media.id, size: media.size, status: media.status });
  } catch (error) {
    return publishingError(error);
  }
}