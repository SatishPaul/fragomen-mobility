import { NextResponse } from "next/server";
import { socialPlatforms, type SocialNetwork } from "@/config/social-platforms";
import { getAuthenticationUrl } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    await requirePublishingSession();
    const body = (await request.json().catch(() => null)) as { network?: SocialNetwork } | null;
    const network = body?.network;
    if (!network || !socialPlatforms.some((platform) => platform.id === network)) {
      throw new Error("Choose a supported social network.");
    }
    if (network === "bluesky") {
      throw new Error("Connect Bluesky in Outstand, then refresh accounts here.");
    }

    const callbackUrl = new URL("/create/publish/callback", request.url).href;
    return NextResponse.json({ url: await getAuthenticationUrl(network, callbackUrl) });
  } catch (error) {
    return publishingError(error);
  }
}