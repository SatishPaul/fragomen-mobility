import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthorizationError, requireAdminApi } from "@/lib/server/auth";
import { listSocialAccounts } from "@/lib/server/outstand";

export const runtime = "nodejs";

const inviteSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().max(100).optional(),
  monthlyTokenQuota: z.number().int().min(0).max(100_000_000),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().trim().max(100).nullable().optional(),
  monthlyTokenQuota: z.number().int().min(0).max(100_000_000).optional(),
  isActive: z.boolean().optional(),
  accountIds: z.array(z.string().min(1)).optional(),
});

function adminError(error: unknown) {
  const status = error instanceof AuthorizationError ? error.status : 400;
  const message = error instanceof Error ? error.message : "Unable to manage users.";
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const { supabase } = await requireAdminApi();
    const [{ data: users, error: usersError }, { data: assignments }, accounts] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,role,is_active,monthly_token_quota,created_at").order("created_at"),
      supabase.from("social_account_assignments").select("user_id,outstand_account_id"),
      listSocialAccounts().catch(() => []),
    ]);
    if (usersError) throw usersError;

    return NextResponse.json({
      users: users?.map((user) => ({
        ...user,
        accountIds: assignments?.filter((assignment) => assignment.user_id === user.id).map((assignment) => assignment.outstand_account_id) || [],
      })) || [],
      accounts: accounts.map((account) => ({ id: account.id, platform: account.network, name: account.nickname || account.username })),
    });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: actor } = await requireAdminApi();
    const input = inviteSchema.parse(await request.json());
    const admin = createAdminClient();
    const origin = request.nextUrl.origin;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { display_name: input.displayName || null },
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    if (error) throw error;

    const { error: profileError } = await admin.from("profiles").update({
      display_name: input.displayName || null,
      monthly_token_quota: input.monthlyTokenQuota,
    }).eq("id", data.user.id);
    if (profileError) throw profileError;

    await admin.from("admin_audit_events").insert({
      actor_user_id: actor.id,
      target_user_id: data.user.id,
      action: "user.invited",
      metadata: { email: input.email, monthlyTokenQuota: input.monthlyTokenQuota },
    });

    return NextResponse.json({ id: data.user.id }, { status: 201 });
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user: actor } = await requireAdminApi();
    const input = updateSchema.parse(await request.json());
    const admin = createAdminClient();

    if (input.userId === actor.id && input.isActive === false) {
      throw new Error("You cannot disable your own administrator account.");
    }

    const profileUpdate = {
      ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
      ...(input.monthlyTokenQuota !== undefined ? { monthly_token_quota: input.monthlyTokenQuota } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    };
    if (Object.keys(profileUpdate).length) {
      const { error } = await admin.from("profiles").update(profileUpdate).eq("id", input.userId);
      if (error) throw error;
    }

    if (input.accountIds) {
      const accounts = await listSocialAccounts();
      const selected = accounts.filter((account) => input.accountIds?.includes(account.id));
      if (selected.length !== input.accountIds.length) throw new Error("One or more social accounts no longer exist.");

      const { error: deleteError } = await admin.from("social_account_assignments").delete().eq("user_id", input.userId);
      if (deleteError) throw deleteError;
      if (selected.length) {
        const { error: insertError } = await admin.from("social_account_assignments").insert(selected.map((account) => ({
          user_id: input.userId,
          outstand_account_id: account.id,
          platform: account.network,
          account_name: account.nickname || account.username,
          account_metadata: { username: account.username, profilePictureUrl: account.profile_picture_url },
          assigned_by: actor.id,
        })));
        if (insertError) throw insertError;
      }
    }

    await admin.from("admin_audit_events").insert({
      actor_user_id: actor.id,
      target_user_id: input.userId,
      action: "user.updated",
      metadata: { fields: Object.keys(input).filter((key) => key !== "userId") },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
