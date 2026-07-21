import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  const { supabase, user } = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: profile, error: profileError }, { data: usage, error: usageError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("monthly_token_quota,is_active")
        .eq("id", user.id)
        .single(),
      supabase
        .from("usage_events")
        .select("total_tokens,reserved_tokens,status")
        .gte("created_at", monthStart.toISOString()),
    ]);

  if (profileError || usageError || !profile?.is_active) {
    return NextResponse.json(
      { error: "Monthly quota is temporarily unavailable." },
      { status: profile?.is_active === false ? 403 : 503 },
    );
  }

  const used = (usage ?? []).reduce(
    (total, event) =>
      total +
      (["succeeded", "failed"].includes(event.status)
        ? Number(event.total_tokens || 0)
        : 0),
    0,
  );
  const reserved = (usage ?? []).reduce(
    (total, event) =>
      total + (event.status === "reserved" ? Number(event.reserved_tokens || 0) : 0),
    0,
  );
  const limit = Number(profile.monthly_token_quota);

  return NextResponse.json({
    used,
    reserved,
    limit,
    remaining: Math.max(0, limit - used - reserved),
  });
}