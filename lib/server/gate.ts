import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = "v2";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

function signature(password: string, expiresAt: string): string {
  return createHmac("sha256", password)
    .update(`${TOKEN_VERSION}.${expiresAt}`)
    .digest("base64url");
}

export function createGateToken(password: string, now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + TOKEN_TTL_SECONDS;
  return `${TOKEN_VERSION}.${expiresAt}.${signature(password, String(expiresAt))}`;
}

export function verifyGateToken(token: string | undefined, password: string, now = Date.now()): boolean {
  if (!token) return false;
  const [version, expiresAt, providedSignature, extra] = token.split(".");
  if (version !== TOKEN_VERSION || !expiresAt || !providedSignature || extra) return false;

  const expires = Number(expiresAt);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now / 1000)) return false;

  const expected = Buffer.from(signature(password, expiresAt));
  const provided = Buffer.from(providedSignature);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export const gateSessionMaxAge = TOKEN_TTL_SECONDS;
