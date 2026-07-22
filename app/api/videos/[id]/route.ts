import { NextResponse } from "next/server";
import { AuthorizationError, requireUserApi } from "@/lib/server/auth";
import { contentDisposition, forwardedRange } from "@/lib/server/video-stream";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { supabase, profile } = await requireUserApi();
    const { id } = await context.params;
    let query = supabase
      .from("videos")
      .select("storage_path,filename,mime_type")
      .eq("id", id)
      .is("deleted_at", null);
    if (profile.role !== "admin") query = query.eq("user_id", profile.id);
    const { data: video } = await query.single();
    if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

    const { data: signed, error } = await supabase.storage.from("videos").createSignedUrl(video.storage_path, 60);
    if (error || !signed?.signedUrl) {
      return NextResponse.json({ error: "Video playback is temporarily unavailable." }, { status: 502 });
    }

    const range = forwardedRange(request.headers.get("range"));
    const upstream = await fetch(signed.signedUrl, { headers: range ? { Range: range } : undefined });
    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "Video playback is temporarily unavailable." }, { status: 502 });
    }

    const headers = new Headers({
      "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
      "Cache-Control": "private, no-store",
      "Content-Type": video.mime_type || "video/mp4",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["content-length", "content-range"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (new URL(request.url).searchParams.get("download") === "1") {
      headers.set("Content-Disposition", contentDisposition(video.filename));
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}