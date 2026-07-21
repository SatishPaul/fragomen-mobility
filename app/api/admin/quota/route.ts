import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthorizationError, requireAdminApi } from "@/lib/server/auth";

export const runtime = "nodejs";

const updateSchema = z.object({
  monthlyTokenBudget: z.number().int().min(0).max(100_000_000),
});

export async function PUT(request: NextRequest) {
  try {
    const { user: actor } = await requireAdminApi();
    const input = updateSchema.parse(await request.json());
    const admin = createAdminClient();
    const { error } = await admin.rpc("set_monthly_token_budget", {
      next_budget: input.monthlyTokenBudget,
      actor_user_id: actor.id,
    });
    if (error) throw error;

    await admin.from("admin_audit_events").insert({
      actor_user_id: actor.id,
      target_user_id: actor.id,
      action: "token_pool.updated",
      metadata: { monthlyTokenBudget: input.monthlyTokenBudget },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 400;
    const message = error instanceof Error ? error.message : "Unable to update the monthly token pool.";
    return NextResponse.json({ error: message }, { status });
  }
}