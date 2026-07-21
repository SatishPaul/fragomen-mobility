import { NextResponse } from "next/server";
import { getPost } from "@/lib/server/outstand";
import { requirePublishingSession } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { validProviderId } from "@/lib/server/publishing-validation";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = (await requirePublishingSession()) ?? { userId: null, supabase: null };
    const { id } = await context.params;
    if (!validProviderId(id)) throw new Error("The post ID is invalid.");
    let publicationId: string | null = null;
    if (session.userId && session.supabase) {
      const { data: ownedPost } = await session.supabase
        .from("publications")
        .select("id")
        .eq("outstand_post_id", id)
        .eq("user_id", session.userId)
        .single();
      if (!ownedPost) throw new Error("The publication could not be found.");
      publicationId = ownedPost.id;
    }
    const post = await getPost(id);
    if (session.userId && session.supabase && publicationId) {
      await Promise.all(post.socialAccounts.map((account) => session.supabase!.from("publication_destinations").update({
        status: account.status === "pending" ? "processing" : account.status,
        remote_post_id: account.platformPostId,
        remote_url: account.platformPostUrl ?? null,
        error_message: account.error,
        published_at: account.publishedAt,
      }).eq("publication_id", publicationId!).eq("user_id", session.userId!).eq("outstand_account_id", account.id)));
      const statuses = post.socialAccounts.map((account) => account.status);
      const status = statuses.every((value) => value === "published")
        ? "published"
        : statuses.every((value) => value !== "pending") ? "failed" : "processing";
      await session.supabase.from("publications").update({ status }).eq("id", publicationId);
    }
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