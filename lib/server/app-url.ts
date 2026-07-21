const LOCAL_APP_URL = "http://localhost:3000";

export function getAppUrl(requestOrigin?: string) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const candidate = configuredUrl
    ? configuredUrl.startsWith("http") ? configuredUrl : `https://${configuredUrl}`
    : requestOrigin || LOCAL_APP_URL;

  const url = new URL(candidate);
  if (!url.hostname.endsWith(".vercel.app") && url.hostname !== "localhost" && url.protocol !== "https:") {
    throw new Error("The application URL must use HTTPS.");
  }

  return url.origin;
}