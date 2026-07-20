import { NextResponse } from "next/server";
import { confirmMediaUpload } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { validProviderId, validVideoSize } from "@/lib/server/publishing-validation";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    await requirePublishingSession();
    const body = (await request.json().catch(() => null)) as { id?: string; size?: number } | null;
    if (!validProviderId(body?.id)) throw new Error("The media ID is invalid.");
    if (!validVideoSize(body?.size)) {
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