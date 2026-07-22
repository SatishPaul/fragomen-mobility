import Link from "next/link";
import { Download, Eye, Film, Gauge, Heart, Send, TrendingUp } from "lucide-react";
import { ConnectedAccountsPanel } from "@/components/ConnectedAccountsPanel";
import { Header } from "@/components/Header";
import { SyncAnalyticsButton } from "@/components/SyncAnalyticsButton";
import { requireUser } from "@/lib/server/auth";

export default async function DashboardPage() {
  const { supabase, profile } = await requireUser();

  const [
    { data: quotaData },
    { data: videos },
    { data: publications },
    { count: videoCount },
    { count: publicationCount },
    { data: snapshots },
  ] = await Promise.all([
    supabase.rpc("current_quota_summary"),
    supabase.from("videos").select("id,title,storage_path,filename,duration_seconds,created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(6),
    supabase.from("publications").select("id,status,outstand_post_id,created_at,publication_destinations(platform,remote_url,status)").order("created_at", { ascending: false }).limit(6),
    supabase.from("videos").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("publications").select("id", { count: "exact", head: true }),
    supabase.from("analytics_snapshots").select("publication_destination_id,views,likes,comments,shares,impressions,reach,captured_at").order("captured_at", { ascending: false }).limit(500),
  ]);

  const quota = quotaData?.[0];
  const usedTokens = Number(quota?.used || 0);
  const reservedTokens = Number(quota?.reserved || 0);
  const quotaLimit = Number(quota?.quota_limit || 0);
  const quotaRemaining = Number(quota?.remaining || 0);
  const quotaPercent = quotaLimit > 0 ? Math.min(100, Math.round(((usedTokens + reservedTokens) / quotaLimit) * 100)) : 0;
  const latestSnapshots = new Map<string, NonNullable<typeof snapshots>[number]>();
  for (const snapshot of snapshots || []) {
    if (!latestSnapshots.has(snapshot.publication_destination_id)) {
      latestSnapshots.set(snapshot.publication_destination_id, snapshot);
    }
  }
  const socialTotals = [...latestSnapshots.values()].reduce((totals, snapshot) => ({
    views: totals.views + Number(snapshot.views || snapshot.impressions || 0),
    likes: totals.likes + Number(snapshot.likes || 0),
  }), { views: 0, likes: 0 });
  const cards = [
    { label: "Tokens this month", value: usedTokens.toLocaleString(), icon: Gauge },
    { label: profile.role === "admin" ? "Shared admin balance" : "Quota remaining", value: quotaRemaining.toLocaleString(), icon: TrendingUp },
    { label: "Saved videos", value: String(videoCount || 0), icon: Film },
    { label: "Publications", value: String(publicationCount || 0), icon: Send },
    { label: "Social views", value: socialTotals.views.toLocaleString(), icon: Eye },
    { label: "Social likes", value: socialTotals.likes.toLocaleString(), icon: Heart },
  ];
  return (
    <><Header /><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-accent">Workspace</p><h1 className="mt-2 font-serif text-3xl text-heading">{profile.display_name ? `${profile.display_name}'s dashboard` : "Your dashboard"}</h1></div><Link href="/create" className="bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg">Create video</Link></div>
      <section className="mt-8 grid gap-px bg-edge sm:grid-cols-2 lg:grid-cols-3">{cards.map(({ label, value, icon: Icon }) => <div key={label} className="bg-surface p-5"><Icon className="h-5 w-5 text-accent" aria-hidden="true" /><p className="mt-5 text-2xl font-semibold text-heading">{value}</p><p className="mt-1 text-xs uppercase text-muted">{label}</p></div>)}</section>
      <section className="mt-8 border border-edge bg-surface p-6"><div className="flex justify-between text-sm"><span className="font-medium text-heading">{profile.role === "admin" ? "Shared administrator token balance" : "Monthly token quota"}</span><span className="text-muted">{(usedTokens + reservedTokens).toLocaleString()} / {quotaLimit.toLocaleString()}</span></div><div className="mt-3 h-2 bg-raised"><div className="h-full bg-accent" style={{ width: `${quotaPercent}%` }} /></div></section>
      <ConnectedAccountsPanel canConnect />
      <div className="mt-8 grid gap-6 lg:grid-cols-2"><section><h2 className="font-serif text-xl text-heading">Recent videos</h2><div className="mt-3 space-y-px bg-edge">{videos?.length ? videos.map((video) => { const streamUrl = `/api/videos/${video.id}`; return <article key={video.id} className="bg-surface p-4"><video controls preload="metadata" playsInline className="aspect-video w-full bg-black" src={streamUrl}>Your browser does not support inline video playback.</video><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium text-heading">{video.title}</p><p className="mt-1 truncate text-xs text-muted">{video.filename}</p></div><div className="flex shrink-0 items-center gap-3"><time className="text-xs text-muted">{new Date(video.created_at).toLocaleDateString()}</time><a href={`${streamUrl}?download=1`} className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"><Download className="h-4 w-4" aria-hidden="true" />Download</a></div></div></article>; }) : <p className="bg-surface p-5 text-sm text-muted">Completed videos will appear here.</p>}</div></section>
      <section><h2 className="font-serif text-xl text-heading">Publishing activity</h2><div className="mt-3 border border-edge bg-surface">{publications?.length ? publications.map((publication) => <div key={publication.id} className="flex items-start justify-between gap-4 border-b border-edge p-4 last:border-0"><div><p className="capitalize text-heading">{publication.status}</p><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">{publication.publication_destinations?.length ? publication.publication_destinations.map((destination: { platform: string; remote_url: string | null }) => destination.remote_url ? <a key={`${publication.id}-${destination.platform}`} href={destination.remote_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{destination.platform}</a> : <span key={`${publication.id}-${destination.platform}`}>{destination.platform}</span>) : "No destinations"}</div></div><div className="flex flex-col items-end gap-2"><time className="text-xs text-muted">{new Date(publication.created_at).toLocaleDateString()}</time>{publication.status === "published" && publication.outstand_post_id && <SyncAnalyticsButton postId={publication.outstand_post_id} />}</div></div>) : <p className="p-5 text-sm text-muted">Published posts and performance will appear here.</p>}</div></section></div>
    </main></>
  );
}
