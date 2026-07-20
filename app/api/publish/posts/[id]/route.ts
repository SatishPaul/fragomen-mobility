import { NextResponse } from "next/server";
import { getPost } from "@/lib/server/outstand";
import { requirePublishingSession } from "@/lib/server/publishing-auth";
import { publishingError, validProviderId } from "@/lib/server/publishing-route";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requirePublishingSession();
    const { id } = await context.params;
    if (!validProviderId(id)) throw new Error("The post ID is invalid.");
    const post = await getPost(id);
    return NextResponse.json({
      id: post.id,
      accounts: post.socialAccounts.map((account) => ({
        id: account.id,
        network: account.network,
        username: account.username,
        status: account.status,
        error: account.error,
        platformPostId: account.platformPostId,
        platformPostUrl: account.platformPostUrl ?? null,
        publishedAt: account.publishedAt,
      })),
    });
  } catch (error) {
    return publishingError(error);
  }
}