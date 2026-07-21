import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { validOutstandSignature } from "@/lib/server/outstand-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type WebhookAccount = {
  accountId: string;
  platformPostId?: string;
  platformPostUrl?: string;
  error?: string;
};

type WebhookPayload = {
  event: string;
  timestamp: string;
  data?: { postId?: string; socialAccounts?: WebhookAccount[] };
};

export async function POST(request: Request) {
  const secret = process.env.OUTSTAND_WEBHOOK_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const rawBody = await request.text();
  if (!validOutstandSignature(rawBody, request.headers.get("x-outstand-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  if (!payload.event || !payload.timestamp) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const admin = createAdminClient();
  const eventId = `${payload.event}:${payload.data?.postId ?? "none"}:${payload.timestamp}`;
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const { data: receipt, error: receiptError } = await admin
    .from("webhook_receipts")
    .insert({ provider: "outstand", event_id: eventId, payload_sha256: payloadHash })
    .select("id")
    .single();

  if (receiptError?.code === "23505") {
    const { data: existing } = await admin
      .from("webhook_receipts")
      .select("id,processed_at")
      .eq("provider", "outstand")
      .eq("event_id", eventId)
      .single();
    if (existing?.processed_at) return NextResponse.json({ received: true, duplicate: true });
    if (!existing) return NextResponse.json({ error: "Unable to record webhook." }, { status: 500 });
    return processWebhook(admin, existing.id, payload);
  }
  if (receiptError || !receipt) {
    return NextResponse.json({ error: "Unable to record webhook." }, { status: 500 });
  }
  return processWebhook(admin, receipt.id, payload);
}

async function processWebhook(
  admin: ReturnType<typeof createAdminClient>,
  receiptId: string,
  payload: WebhookPayload,
) {
  try {
    const postId = payload.data?.postId;
    if (postId && ["post.published", "post.error"].includes(payload.event)) {
      const status = payload.event === "post.published" ? "published" : "failed";
      const accounts = payload.data?.socialAccounts ?? [];
      const { data: publication, error: publicationError } = await admin
        .from("publications")
        .select("id")
        .eq("outstand_post_id", postId)
        .single();
      if (publicationError || !publication) throw publicationError ?? new Error("Publication not found.");
      await Promise.all(accounts.map(async (account) => {
        const { error } = await admin.from("publication_destinations").update({
          status,
          remote_post_id: account.platformPostId ?? null,
          remote_url: account.platformPostUrl ?? null,
          error_message: account.error ?? null,
          published_at: status === "published" ? payload.timestamp : null,
        })
        .eq("outstand_account_id", String(account.accountId))
        .eq("publication_id", publication.id);
        if (error) throw error;
      }));
      const { error: updateError } = await admin
        .from("publications")
        .update({ status })
        .eq("id", publication.id);
      if (updateError) throw updateError;
    }
    await admin.from("webhook_receipts").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("id", receiptId);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await admin.from("webhook_receipts").update({ processing_error: message }).eq("id", receiptId);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}