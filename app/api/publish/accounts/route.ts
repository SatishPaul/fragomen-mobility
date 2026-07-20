import { NextResponse } from "next/server";
import { getAccountHealth, listSocialAccounts } from "@/lib/server/outstand";
import { requirePublishingSession } from "@/lib/server/publishing-auth";
import { publishingError } from "@/lib/server/publishing-route";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    await requirePublishingSession();
    const accounts = await listSocialAccounts();
    const health = await Promise.all(accounts.map(async (account) => {
      try {
        return await getAccountHealth(account.id);
      } catch {
        return null;
      }
    }));

    return NextResponse.json({
      accounts: accounts.map((account, index) => ({
        id: account.id,
        network: account.network,
        nickname: account.nickname,
        username: account.username,
        profilePictureUrl: account.profile_picture_url ?? undefined,
        active: account.isActive === true || account.isActive === 1,
        healthy: health[index]?.healthy ?? false,
      })),
    });
  } catch (error) {
    return publishingError(error);
  }
}