/**
 * Best-effort in-memory IP throttle for the two API routes (TRD §3.4).
 * Serverless instances don't share memory, so this is a soft guard, not a
 * security boundary — fine for a single-user tool.
 */

const WINDOW_MS = 60_000;

const hits = new Map<string, number[]>();

export function throttled(ip: string, limit: number): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= limit) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  // Keep the map from growing unboundedly on long-lived instances.
  if (hits.size > 1000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
  );
}
