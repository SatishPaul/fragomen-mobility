import "server-only";

import type {
  OutstandAccountHealth,
  OutstandCreatePostRequest,
  OutstandMedia,
  OutstandPendingConnection,
  OutstandPost,
  OutstandPostAnalytics,
  OutstandSocialAccount,
} from "@/lib/outstand/types";

const baseUrl = "https://api.outstand.so/v1";
const requestTimeoutMs = 15_000;

export class OutstandError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
  }
}

function apiKey(): string {
  const value = process.env.OUTSTAND_API_KEY?.trim();
  if (!value) throw new OutstandError("Social publishing is not configured.", 503);
  return value;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function outstandRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new OutstandError("Outstand did not respond in time.", 504);
    }
    throw new OutstandError("Unable to reach Outstand.");
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = record(payload)?.error;
    const message = typeof error === "string" && response.status < 500
      ? error
      : "Outstand could not complete the request.";
    throw new OutstandError(message, response.status >= 500 ? 502 : response.status);
  }
  if (!record(payload)?.success) {
    throw new OutstandError("Outstand returned an invalid response.");
  }
  return payload as T;
}

export async function listSocialAccounts(tenantId?: string): Promise<OutstandSocialAccount[]> {
  const parameters = new URLSearchParams({ limit: "100", offset: "0", includeTokens: "false" });
  if (tenantId) parameters.set("tenantId", tenantId);
  const response = await outstandRequest<{ data: OutstandSocialAccount[] }>(
    `/social-accounts?${parameters}`,
  );
  if (!Array.isArray(response.data)) throw new OutstandError("Outstand returned invalid accounts.");
  return response.data;
}

export async function getAccountHealth(id: string): Promise<OutstandAccountHealth> {
  const response = await outstandRequest<{ data: OutstandAccountHealth }>(
    `/social-accounts/${encodeURIComponent(id)}/health`,
  );
  return response.data;
}

export async function getAuthenticationUrl(network: string, redirectUri: string, tenantId?: string): Promise<string> {
  const response = await outstandRequest<{ data: { auth_url: string } }>(
    `/social-networks/${encodeURIComponent(network)}/auth-url`,
    {
      method: "POST",
      body: JSON.stringify({
        redirect_uri: redirectUri,
        ...(tenantId ? { tenant_id: tenantId } : {}),
      }),
    },
  );
  if (typeof response.data?.auth_url !== "string") {
    throw new OutstandError("Outstand returned an invalid connection URL.");
  }
  return response.data.auth_url;
}

export async function createMediaUpload(filename: string): Promise<{ id: string; uploadUrl: string; expiresIn: number }> {
  const response = await outstandRequest<{
    data: { id: string; upload_url: string; expires_in: number };
  }>("/media/upload", {
    method: "POST",
    body: JSON.stringify({ filename, content_type: "video/mp4" }),
  });
  if (typeof response.data?.id !== "string" || typeof response.data.upload_url !== "string") {
    throw new OutstandError("Outstand returned an invalid media upload URL.");
  }
  return {
    id: response.data.id,
    uploadUrl: response.data.upload_url,
    expiresIn: response.data.expires_in,
  };
}

export async function confirmMediaUpload(id: string, size: number): Promise<OutstandMedia> {
  const response = await outstandRequest<{ data: OutstandMedia }>(
    `/media/${encodeURIComponent(id)}/confirm`,
    { method: "POST", body: JSON.stringify({ size }) },
  );
  return response.data;
}

export async function createPost(input: OutstandCreatePostRequest): Promise<OutstandPost> {
  const response = await outstandRequest<{ post: OutstandPost }>("/posts/", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (typeof response.post?.id !== "string") throw new OutstandError("Outstand returned an invalid post.");
  return response.post;
}

export async function getPost(id: string): Promise<OutstandPost> {
  const response = await outstandRequest<{ post: OutstandPost }>(
    `/posts/${encodeURIComponent(id)}`,
  );
  return response.post;
}

export async function getPostAnalytics(id: string): Promise<OutstandPostAnalytics> {
  const response = await outstandRequest<OutstandPostAnalytics & { success: boolean }>(
    `/posts/${encodeURIComponent(id)}/analytics`,
  );
  if (!Array.isArray(response.metrics_by_account)) {
    throw new OutstandError("Outstand returned invalid post analytics.");
  }
  return response;
}

async function outstandSessionRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  }).catch(() => {
    throw new OutstandError("Unable to reach Outstand.");
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !record(payload)?.success) {
    throw new OutstandError("Outstand could not complete the pending connection.", response.status >= 500 ? 502 : response.status);
  }
  return payload as T;
}

export async function getPendingConnection(sessionToken: string): Promise<OutstandPendingConnection> {
  const response = await outstandSessionRequest<{ data: OutstandPendingConnection }>(
    `/social-accounts/pending/${encodeURIComponent(sessionToken)}`,
  );
  if (!response.data || !Array.isArray(response.data.availablePages)) {
    throw new OutstandError("Outstand returned an invalid pending connection.");
  }
  return response.data;
}

export async function finalizePendingConnection(
  sessionToken: string,
  selectedPageIds: string[],
): Promise<OutstandSocialAccount[]> {
  const response = await outstandSessionRequest<{ connectedAccounts: OutstandSocialAccount[] }>(
    `/social-accounts/pending/${encodeURIComponent(sessionToken)}/finalize`,
    { method: "POST", body: JSON.stringify({ selectedPageIds }) },
  );
  if (!Array.isArray(response.connectedAccounts) || response.connectedAccounts.length === 0) {
    throw new OutstandError("Outstand did not return a connected account.");
  }
  return response.connectedAccounts;
}