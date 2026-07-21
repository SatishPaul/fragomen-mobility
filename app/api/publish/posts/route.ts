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
    const session = (await requirePublishingSession()) ?? { userId: null, supabase: null };
    if (throttled(`publish-post:${clientIp(request)}`, 4)) {
      throw new Error("Too many publish attempts. Wait a minute and try again.");
    }
    const body = (await request.json().catch(() => null)) as {
      accountIds?: string[];
      content?: string;
      mediaId?: string;
      videoId?: string;
      idempotencyKey?: string;
    } | null;
    const accountIds = [...new Set(body?.accountIds ?? [])];
    const content = body?.content?.trim() ?? "";
    if (accountIds.length === 0 || accountIds.length > 20 || !accountIds.every(validProviderId)) {
      throw new Error("Choose between 1 and 20 valid social accounts.");
    }
    if (!content || content.length > 5000) throw new Error("The caption must be between 1 and 5,000 characters.");
    if (!validProviderId(body?.mediaId)) throw new Error("The confirmed media ID is invalid.");
    if (session.userId && (!body?.videoId || !body?.idempotencyKey)) {
      throw new Error("Save the completed video before publishing.");
    }

    const accounts = await listSocialAccounts();
    const activeAccounts = accounts
      .filter((account) => account.isActive === true || account.isActive === 1)
      .filter((account) => socialPlatforms.some((platform) =>
        platform.id === account.network && platform.publishingEnabled !== false));
    const activeIds = new Set(activeAccounts.map((account) => account.id));
    if (!accountIds.every((id) => activeIds.has(id))) {
      throw new Error("One or more selected accounts are no longer connected.");
    }

    if (session.userId && session.supabase) {
      const { data: assignments, error } = await session.supabase
        .from("social_account_assignments")
        .select("outstand_account_id")
        .eq("user_id", session.userId)
        .eq("is_active", true)
        .in("outstand_account_id", accountIds);
      if (error) throw error;
      if (assignments?.length !== accountIds.length) {
        throw new Error("One or more selected accounts are not assigned to you.");
      }
      const { data: video } = await session.supabase
        .from("videos")
        .select("id")
        .eq("id", body.videoId)
        .eq("user_id", session.userId)
        .single();
      if (!video) throw new Error("The saved video could not be found.");
    }

    const post = await createPost({ content, accounts: accountIds, mediaIds: [body.mediaId] });
    if (session.userId && session.supabase) {
      const { data: publication, error } = await session.supabase
        .from("publications")
        .insert({
          user_id: session.userId,
          video_id: body!.videoId,
          idempotency_key: body!.idempotencyKey,
          caption: content,
          status: "processing",
          outstand_post_id: post.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const accountsById = new Map(activeAccounts.map((account) => [account.id, account]));
      const { error: destinationsError } = await session.supabase
        .from("publication_destinations")
        .insert(accountIds.map((accountId) => ({
          publication_id: publication.id,
          user_id: session.userId,
          outstand_account_id: accountId,
          platform: accountsById.get(accountId)!.network,
          status: "processing",
        })));
      if (destinationsError) throw destinationsError;
    }
    return NextResponse.json({ id: post.id });
  } catch (error) {
    return publishingError(error);
  }
}