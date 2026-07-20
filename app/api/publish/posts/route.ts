import { NextResponse } from "next/server";
import { socialPlatforms } from "@/config/social-platforms";
import { createPost, listSocialAccounts } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { validProviderId } from "@/lib/server/publishing-validation";
import { clientIp, throttled } from "@/lib/server/throttle";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    await requirePublishingSession();
    if (throttled(`publish-post:${clientIp(request)}`, 4)) {
      throw new Error("Too many publish attempts. Wait a minute and try again.");
    }
    const body = (await request.json().catch(() => null)) as {
      accountIds?: string[];
      content?: string;
      mediaId?: string;
    } | null;
    const accountIds = [...new Set(body?.accountIds ?? [])];
    const content = body?.content?.trim() ?? "";
    if (accountIds.length === 0 || accountIds.length > 20 || !accountIds.every(validProviderId)) {
      throw new Error("Choose between 1 and 20 valid social accounts.");
    }
    if (!content || content.length > 5000) throw new Error("The caption must be between 1 and 5,000 characters.");
    if (!validProviderId(body?.mediaId)) throw new Error("The confirmed media ID is invalid.");

    const accounts = await listSocialAccounts();
    const activeAccounts = accounts
      .filter((account) => account.isActive === true || account.isActive === 1)
      .filter((account) => socialPlatforms.some((platform) =>
        platform.id === account.network && platform.publishingEnabled !== false));
    const activeIds = new Set(activeAccounts.map((account) => account.id));
    if (!accountIds.every((id) => activeIds.has(id))) {
      throw new Error("One or more selected accounts are no longer connected.");
    }

    const post = await createPost({ content, accounts: accountIds, mediaIds: [body.mediaId] });
    return NextResponse.json({ id: post.id });
  } catch (error) {
    return publishingError(error);
  }
}