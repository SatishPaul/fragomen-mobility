import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { finalizePendingConnection, getPendingConnection, listSocialAccounts } from "@/lib/server/outstand";
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
    const body = await request.json().catch(() => null) as {
      success?: string | null;
      accountId?: string | null;
      username?: string | null;
      pendingSession?: string | null;
      selectedPageIds?: string[];
    } | null;
    if (!body?.pendingSession && (body?.success !== "true" || !body.accountId)) {
      throw new Error("Outstand did not confirm the social account connection. Connect the account again.");
    }
    const secret = process.env.OUTSTAND_API_KEY?.trim();
    const cookieStore = await cookies();
    const snapshot = secret
      ? readSocialConnectionToken(cookieStore.get(socialConnectionCookie)?.value, secret)
      : null;
    if (!snapshot || snapshot.userId !== session.userId) {
      throw new Error("The social connection expired. Connect the account again.");
    }

    let accounts;
    if (body.pendingSession) {
      const pending = await getPendingConnection(body.pendingSession);
      if (pending.network !== snapshot.network) throw new Error("The pending account does not match the requested provider.");
      const availableIds = new Set(pending.availablePages.map((page) => page.id));
      const selectedPageIds = body.selectedPageIds?.length
        ? body.selectedPageIds
        : pending.availablePages.length === 1 ? [pending.availablePages[0].id] : [];
      if (selectedPageIds.length === 0) {
        return NextResponse.json({ pending: { pages: pending.availablePages } });
      }
      if (selectedPageIds.some((id) => !availableIds.has(id))) {
        throw new Error("The selected social account is not available in this connection.");
      }
      const finalized = await finalizePendingConnection(body.pendingSession, selectedPageIds);
      const tenantAccounts = await listSocialAccounts(session.userId);
      const tenantIds = new Set(tenantAccounts.map((account) => account.id));
      accounts = finalized.filter((account) => account.network === snapshot.network && tenantIds.has(account.id));
    } else {
      const account = (await listSocialAccounts(session.userId)).find((candidate) =>
        candidate.id === body.accountId &&
        candidate.network === snapshot.network &&
        (!body.username || candidate.username === body.username));
      accounts = account ? [account] : [];
    }
    if (accounts.length === 0) throw new Error("Outstand could not verify this account for the signed-in user.");

    const admin = createAdminClient();
    for (const account of accounts) {
      const { data: existingAssignments, error: assignmentsError } = await admin
        .from("social_account_assignments")
        .select("user_id,outstand_account_id")
        .eq("outstand_account_id", account.id);
      if (assignmentsError) throw assignmentsError;
      const existingAssignment = existingAssignments?.[0];
      if (existingAssignment && existingAssignment.user_id !== session.userId) {
        throw new Error("The connected social account is already assigned to another user.");
      }
      const assignment = {
        user_id: session.userId,
        outstand_account_id: account.id,
        platform: account.network,
        account_name: account.nickname || account.username,
        account_metadata: { username: account.username, profilePictureUrl: account.profile_picture_url || null },
        is_active: true,
        assigned_by: session.userId,
      };
      if (existingAssignment) {
        const { error: updateError } = await admin
          .from("social_account_assignments")
          .update(assignment)
          .eq("outstand_account_id", account.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await admin.from("social_account_assignments").insert([assignment]);
        if (insertError) throw insertError;
      }
    }

    const response = NextResponse.json({ accounts: accounts.map((account) => ({
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