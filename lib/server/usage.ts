import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/server/auth";

type UsageOperation = "analyze" | "script" | "tts" | "render";
type UsageStatus = "succeeded" | "failed" | "released";

type Reservation = {
  client: SupabaseClient;
  eventId: string;
};

export class QuotaError extends Error {}

export function providerName(baseUrl: string) {
  return baseUrl.includes("groq.com") ? "groq" : "openrouter";
}

export async function reserveUsage(
  operation: UsageOperation,
  provider: string,
  model: string | null,
  estimatedTokens: number,
  requestId: string,
): Promise<Reservation | null> {
  if (!isSupabaseConfigured()) return null;

  const { supabase, user } = await getAuthenticatedUser();
  if (!user) throw new QuotaError("Authentication required.");
  const { data, error } = await supabase.rpc("reserve_usage", {
    requested_operation: operation,
    requested_provider: provider,
    requested_model: model,
    requested_tokens: Math.max(0, Math.ceil(estimatedTokens)),
    requested_request_id: requestId,
  });

  if (error) throw new QuotaError(error.message.includes("quota") ? "Monthly token quota exceeded." : error.message);
  const event = Array.isArray(data) ? data[0] : data;
  return { client: supabase, eventId: event.id };
}

export async function finalizeUsage(
  reservation: Reservation | null,
  status: UsageStatus,
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    characters?: number | null;
    audioSeconds?: number | null;
    errorCode?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (!reservation) return;
  const { error } = await reservation.client.rpc("finalize_usage", {
    event_id: reservation.eventId,
    final_status: status,
    final_input_tokens: usage?.inputTokens ?? null,
    final_output_tokens: usage?.outputTokens ?? null,
    final_characters: usage?.characters ?? null,
    final_audio_seconds: usage?.audioSeconds ?? null,
    final_error_code: usage?.errorCode ?? null,
    final_metadata: usage?.metadata ?? {},
  });
  if (error) console.error("[usage] Unable to finalize reservation:", error.message);
}

export function completionUsage(data: unknown) {
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const usage = record.usage && typeof record.usage === "object" ? record.usage as Record<string, unknown> : {};
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    inputTokens: number(usage.prompt_tokens ?? usage.input_tokens),
    outputTokens: number(usage.completion_tokens ?? usage.output_tokens),
  };
}
