import { NextResponse } from "next/server";
import { getPostAnalytics } from "@/lib/server/outstand";
import { requirePublishingSession } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { validProviderId } from "@/lib/server/publishing-validation";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePublishingSession();
    if (!session?.userId || !session.supabase) {
      throw new Error("User analytics require an authenticated account.");
    }
    const { id } = await context.params;
    if (!validProviderId(id)) throw new Error("The post ID is invalid.");

    const { data: publication } = await session.supabase
      .from("publications")
      .select("id,publication_destinations(id,outstand_account_id)")
      .eq("outstand_post_id", id)
      .eq("user_id", session.userId)
      .single();
    if (!publication) throw new Error("The publication could not be found.");

    const analytics = await getPostAnalytics(id);
    const destinationIds = new Map(
      publication.publication_destinations.map((destination) => [
        destination.outstand_account_id,
        destination.id,
      ]),
    );
    const snapshots = analytics.metrics_by_account.flatMap((account) => {
      const destinationId = destinationIds.get(account.social_account.id);
      if (!destinationId) return [];
      const platform = account.metrics.platform_specific ?? {};
      return [{
        user_id: session.userId,
        publication_destination_id: destinationId,
        impressions: account.metrics.impressions ?? null,
        reach: account.metrics.reach ?? null,
        views: account.metrics.views ?? null,
        likes: account.metrics.likes ?? null,
        comments: account.metrics.comments ?? null,
        shares: account.metrics.shares ?? null,
        clicks: typeof platform.clicks === "number" ? platform.clicks : null,
        watch_seconds: typeof platform.watch_seconds === "number" ? platform.watch_seconds : null,
        raw_metrics: { ...account.metrics, metrics_error: account.metrics_error ?? null },
      }];
    });
    if (snapshots.length) {
      const { error } = await session.supabase.from("analytics_snapshots").insert(snapshots);
      if (error) throw error;
    }

    return NextResponse.json({
      captured: snapshots.length,
      metrics: analytics.aggregated_metrics,
    });
  } catch (error) {
    return publishingError(error);
  }
}