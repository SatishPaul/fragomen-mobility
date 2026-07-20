import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  socialStagingPrefix,
  socialVideoMaxBytes,
} from "@/lib/server/blob-staging";
import {
  requirePublishingSession,
  requireSameOrigin,
} from "@/lib/server/publishing-auth";
import { clientIp, throttled } from "@/lib/server/throttle";

export const runtime = "nodejs";

const stagedVideoPath = /^social-staging\/\d{13}-[a-zA-Z0-9_-]{1,80}\.mp4$/;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    const body = (await request.json()) as HandleUploadBody;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        await requirePublishingSession();
        if (throttled(`publish-upload:${clientIp(request)}`, 6)) {
          throw new Error("Too many upload attempts. Wait a minute and try again.");
        }
        if (!stagedVideoPath.test(pathname) || !pathname.startsWith(socialStagingPrefix)) {
          throw new Error("The upload pathname is not valid for social staging.");
        }

        return {
          allowedContentTypes: ["video/mp4"],
          maximumSizeInBytes: socialVideoMaxBytes(),
          validUntil: Date.now() + 10 * 60 * 1000,
          addRandomSuffix: true,
          allowOverwrite: false,
          cacheControlMaxAge: 60,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        if (!blob.pathname.startsWith(socialStagingPrefix)) {
          throw new Error("The completed upload is outside social staging.");
        }
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to authorize the video upload.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}