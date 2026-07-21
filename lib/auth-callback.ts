export function safeAuthDestination(requestedNext: string | null) {
  return requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";
}

export function readFragmentSession(hash: string) {
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const errorCode = fragment.get("error_code");
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");

  if (errorCode || !accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function isSupabaseAuthFragment(hash: string) {
  const fragment = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const type = fragment.get("type");
  return type === "invite" || type === "recovery" || fragment.has("error_code");
}