import { NextResponse } from "next/server";
import { socialPlatforms, type SocialNetwork } from "@/config/social-platforms";
import { getAuthenticationUrl, listSocialAccounts } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { createSocialConnectionToken, socialConnectionCookie } from "@/lib/server/social-connection";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    const session = await requirePublishingSession();
    const body = (await request.json().catch(() => null)) as { network?: SocialNetwork } | null;
    const network = body?.network;
    if (!network || !socialPlatforms.some((platform) => platform.id === network)) {
      throw new Error("Choose a supported social network.");
    }
    if (network === "bluesky") {
      throw new Error("Connect Bluesky in Outstand, then refresh accounts here.");
    }

    const callbackUrl = new URL("/create/publish/callback", request.url).href;
    const response = NextResponse.json({ url: await getAuthenticationUrl(network, callbackUrl) });
    if (session?.userId) {
      const secret = process.env.OUTSTAND_API_KEY?.trim();
      if (!secret) throw new Error("Social publishing is not configured.");
      const accounts = await listSocialAccounts();
      response.cookies.set(socialConnectionCookie, createSocialConnectionToken({
        userId: session.userId,
        network,
        existingAccountIds: accounts.map((account) => account.id),
      }, secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/api/publish/accounts/complete",
      });
    }
    return response;
  } catch (error) {
    return publishingError(error);
  }
}