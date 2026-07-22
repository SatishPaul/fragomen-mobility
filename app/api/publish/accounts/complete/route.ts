import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listSocialAccounts } from "@/lib/server/outstand";
import { requirePublishingSession, requireSameOrigin } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";
import { readSocialConnectionToken, socialConnectionCookie } from "@/lib/server/social-connection";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireSameOrigin(request);
    const session = await requirePublishingSession();
    if (!session?.userId) throw new Error("Account assignment requires multi-user authentication.");
    const secret = process.env.OUTSTAND_API_KEY?.trim();
    const cookieStore = await cookies();
    const snapshot = secret
      ? readSocialConnectionToken(cookieStore.get(socialConnectionCookie)?.value, secret)
      : null;
    if (!snapshot || snapshot.userId !== session.userId) {
      throw new Error("The social connection expired. Connect the account again.");
    }

    const previousIds = new Set(snapshot.existingAccountIds);
    const newAccounts = (await listSocialAccounts()).filter((account) =>
      account.network === snapshot.network && !previousIds.has(account.id));
    if (newAccounts.length === 0) {
      throw new Error("No new social account was detected. Reconnect the account and try again.");
    }

    const admin = createAdminClient();
    const { data: existingAssignments, error: assignmentsError } = await admin
      .from("social_account_assignments")
      .select("outstand_account_id")
      .in("outstand_account_id", newAccounts.map((account) => account.id));
    if (assignmentsError) throw assignmentsError;
    const assignedIds = new Set(existingAssignments?.map((assignment) => assignment.outstand_account_id));
    const assignable = newAccounts.filter((account) => !assignedIds.has(account.id));
    if (assignable.length !== newAccounts.length) {
      throw new Error("The connected social account is already assigned to another user.");
    }

    const { error: insertError } = await admin.from("social_account_assignments").insert(assignable.map((account) => ({
      user_id: session.userId,
      outstand_account_id: account.id,
      platform: account.network,
      account_name: account.nickname || account.username,
      account_metadata: { username: account.username, profilePictureUrl: account.profile_picture_url || null },
      is_active: true,
      assigned_by: session.userId,
    })));
    if (insertError) throw insertError;

    const response = NextResponse.json({ accounts: assignable.map((account) => ({
      id: account.id,
      network: account.network,
      nickname: account.nickname,
      username: account.username,
    })) });
    response.cookies.set(socialConnectionCookie, "", { maxAge: 0, path: "/api/publish/accounts/complete" });
    return response;
  } catch (error) {
    const response = publishingError(error);
    response.cookies.set(socialConnectionCookie, "", { maxAge: 0, path: "/api/publish/accounts/complete" });
    return response;
  }
}