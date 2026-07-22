import { createHmac, timingSafeEqual } from "node:crypto";
import type { SocialNetwork } from "@/config/social-platforms";

export const socialConnectionCookie = "vm_social_connect";

export interface SocialConnectionSnapshot {
  userId: string;
  network: SocialNetwork;
  existingAccountIds: string[];
  expiresAt: number;
}

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

export function createSocialConnectionToken(
  snapshot: Omit<SocialConnectionSnapshot, "expiresAt">,
  secret: string,
  now = Date.now(),
): string {
  const payload = Buffer.from(JSON.stringify({ ...snapshot, expiresAt: now + 10 * 60 * 1000 }), "utf8").toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function readSocialConnectionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): SocialConnectionSnapshot | null {
  if (!token) return null;
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expected = Buffer.from(signature(payload, secret));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const snapshot = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SocialConnectionSnapshot;
    if (!snapshot.userId || !snapshot.network || !Array.isArray(snapshot.existingAccountIds) || snapshot.expiresAt < now) return null;
    if (!snapshot.existingAccountIds.every((id) => typeof id === "string")) return null;
    return snapshot;
  } catch {
    return null;
  }
}