import { NextResponse } from "next/server";
import { AuthorizationError, requireAdminApi } from "@/lib/server/auth";

export const runtime = "nodejs";

type OpenRouterKeyData = {
  label?: string;
  is_free_tier?: boolean;
  limit?: number | null;
  limit_remaining?: number | null;
  usage?: number | null;
  usage_monthly?: number | null;
};

export async function GET() {
  try {
    await requireAdminApi();
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    let openRouter: OpenRouterKeyData | null = null;
    let openRouterError: string | null = null;

    if (openRouterKey) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/key", {
          headers: { Authorization: `Bearer ${openRouterKey}` },
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`OpenRouter returned ${response.status}.`);
        const payload = await response.json() as { data?: OpenRouterKeyData };
        openRouter = payload.data || null;
      } catch (error) {
        openRouterError = error instanceof Error ? error.message : "OpenRouter capacity is unavailable.";
      }
    }

    return NextResponse.json({
      openRouter: {
        configured: Boolean(openRouterKey),
        plan: openRouter?.is_free_tier === true ? "Free tier" : openRouter?.is_free_tier === false ? "Paid credits" : "Unknown",
        creditLimitUsd: openRouter?.limit ?? null,
        creditRemainingUsd: openRouter?.limit_remaining ?? null,
        usageUsd: openRouter?.usage ?? null,
        usageMonthlyUsd: openRouter?.usage_monthly ?? null,
        tokenLimit: null,
        error: openRouterError,
      },
      groq: {
        configured: Boolean(process.env.GROQ_API_KEY),
        tokenLimit: null,
      },
    });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 503;
    const message = error instanceof Error ? error.message : "Provider capacity is unavailable.";
    return NextResponse.json({ error: message }, { status });
  }
}