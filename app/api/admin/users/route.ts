import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { validateAdminMutation, type ManagedRole } from "@/lib/admin-users";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/server/app-url";
import { AuthorizationError, requireAdminApi } from "@/lib/server/auth";
import { listSocialAccounts } from "@/lib/server/outstand";

export const runtime = "nodejs";

const inviteSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().max(100).optional(),
  monthlyTokenQuota: z.number().int().min(0).max(100_000_000),
  role: z.enum(["admin", "user"]),
});

const updateSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string().trim().max(100).nullable().optional(),
  monthlyTokenQuota: z.number().int().min(0).max(100_000_000).optional(),
  role: z.enum(["admin", "user"]).optional(),
  isActive: z.boolean().optional(),
  accountIds: z.array(z.string().min(1)).optional(),
});

const deleteSchema = z.object({ userId: z.string().uuid() });

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match || data.users.length < perPage) return match || null;
  }
}

async function getMutationContext(userId: string) {
  const admin = createAdminClient();
  const [{ data: target, error: targetError }, { count, error: countError }] = await Promise.all([
    admin.from("profiles").select("id,email,role,is_active").eq("id", userId).single(),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true),
  ]);
  if (targetError) throw targetError;
  if (countError) throw countError;
  return { target, activeAdminCount: count || 0 };
}

function adminError(error: unknown) {
  const status = error instanceof AuthorizationError ? error.status : 400;
  const message = error instanceof Error ? error.message : "Unable to manage users.";
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const { supabase, user: actor } = await requireAdminApi();
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
      currentUserId: actor.id,
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
    const origin = getAppUrl(request.nextUrl.origin);
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingAuthUser = await findAuthUserByEmail(normalizedEmail);

    if (existingAuthUser) {
      const { data: existingProfile, error: profileLookupError } = await admin
        .from("profiles")
        .select("id")
        .eq("id", existingAuthUser.id)
        .maybeSingle();
      if (profileLookupError) throw profileLookupError;
      if (existingProfile) {
        throw new Error("This user already exists. Update or delete the user in the Users section below.");
      }

      const { error: insertError } = await admin.from("profiles").insert({
        id: existingAuthUser.id,
        email: normalizedEmail,
        display_name: input.displayName || null,
        role: input.role,
        monthly_token_quota: input.monthlyTokenQuota,
      });
      if (insertError) throw insertError;

      const { error: resetError } = await admin.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) throw resetError;

      await admin.from("admin_audit_events").insert({
        actor_user_id: actor.id,
        target_user_id: existingAuthUser.id,
        action: "user.recovered",
        metadata: { email: normalizedEmail, monthlyTokenQuota: input.monthlyTokenQuota, role: input.role },
      });

      return NextResponse.json({ id: existingAuthUser.id, recovered: true }, { status: 200 });
    }

    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, {
      data: { display_name: input.displayName || null },
      redirectTo: `${origin}/auth/complete?next=/reset-password`,
    });
    if (error) throw error;

    const { error: profileError } = await admin.from("profiles").update({
      display_name: input.displayName || null,
      monthly_token_quota: input.monthlyTokenQuota,
      role: input.role,
    }).eq("id", data.user.id);
    if (profileError) throw profileError;

    await admin.from("admin_audit_events").insert({
      actor_user_id: actor.id,
      target_user_id: data.user.id,
      action: "user.invited",
      metadata: { email: normalizedEmail, monthlyTokenQuota: input.monthlyTokenQuota, role: input.role },
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
    const { target, activeAdminCount } = await getMutationContext(input.userId);
    validateAdminMutation({
      actorId: actor.id,
      targetId: input.userId,
      currentRole: target.role as ManagedRole,
      currentIsActive: target.is_active,
      nextRole: input.role,
      nextIsActive: input.isActive,
      activeAdminCount,
    });

    const profileUpdate = {
      ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
      ...(input.monthlyTokenQuota !== undefined ? { monthly_token_quota: input.monthlyTokenQuota } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
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

export async function DELETE(request: NextRequest) {
  try {
    const { user: actor } = await requireAdminApi();
    const input = deleteSchema.parse(await request.json());
    const admin = createAdminClient();
    const { target, activeAdminCount } = await getMutationContext(input.userId);

    validateAdminMutation({
      actorId: actor.id,
      targetId: input.userId,
      currentRole: target.role as ManagedRole,
      currentIsActive: target.is_active,
      activeAdminCount,
      deleteUser: true,
    });

    const { data: videos, error: videosError } = await admin
      .from("videos")
      .select("storage_path")
      .eq("user_id", input.userId);
    if (videosError) throw videosError;
    const storagePaths = videos?.map((video) => video.storage_path).filter(Boolean) || [];
    if (storagePaths.length) {
      const { error: storageError } = await admin.storage.from("videos").remove(storagePaths);
      if (storageError) throw storageError;
    }

    await admin.from("admin_audit_events").insert({
      actor_user_id: actor.id,
      target_user_id: input.userId,
      action: "user.deleted",
      metadata: { email: target.email },
    });

    const { error } = await admin.auth.admin.deleteUser(input.userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return adminError(error);
  }
}
