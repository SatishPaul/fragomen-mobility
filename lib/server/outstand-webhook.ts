import { createHmac, timingSafeEqual } from "node:crypto";

export function validOutstandSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
) {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}