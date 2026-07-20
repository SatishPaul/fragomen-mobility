import { cookies } from "next/headers";
import { verifyGateToken } from "./gate";

export async function requirePublishingSession(): Promise<void> {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error("Social publishing requires APP_PASSWORD to be configured.");
  }

  const cookieStore = await cookies();
  if (!verifyGateToken(cookieStore.get("vm_auth")?.value, password)) {
    throw new Error("Your session has expired. Sign in again before publishing.");
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new Error("Cross-origin publishing requests are not allowed.");
  }
}