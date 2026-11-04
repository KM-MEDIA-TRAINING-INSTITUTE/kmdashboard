import type { ApiErrorBody, TokenPair } from "./types";
import { tokenStore } from "./token-store";

/**
 * Thin fetch wrapper for the LMS API.
 *
 * - Attaches the bearer access token when present.
 * - On 401 with a refresh token available, refreshes ONCE and replays the
 *   original request (concurrent 401s share a single in-flight refresh).
 * - On failed refresh: clears tokens and redirects to /login?reason=expired.
 * - Never throws raw Responses: raises ApiError with the backend's
 *   {"error": {code, message, details}} envelope.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

/** API server origin (strips /api/v1) — for serving uploaded assets like /uploads/avatars. */
export function apiOrigin(): string {
  return BASE_URL.replace(/\/api\/v1\/?$/, "");
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: ApiErrorBody["error"]["details"];

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error?.code ?? "unknown";
    this.details = body?.error?.details;
  }
}

let refreshing: Promise<boolean> | null = null;

/** Attempt one refresh rotation. Returns true on success. */
export async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return false;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) {
    // Reuse detected or session dead — the whole family is gone.
    tokenStore.clear();
    return false;
  }

  const pair = (await res.json()) as TokenPair;
  tokenStore.set(pair);
  return true;
}

function redirectToLogin(reason: "expired" | "reused") {
  tokenStore.clear();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = `/login?reason=${reason}`;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {}
): Promise<T> {
  const { skipAuth, headers, ...rest } = options;

  const doFetch = () => {
    const token = skipAuth ? null : tokenStore.getAccess();
    return fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        ...(rest.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuth && tokenStore.getRefresh()) {
    // Single-flight: concurrent 401s await the same refresh call.
    refreshing ??= tryRefresh();
    const ok = await refreshing;
    refreshing = null;

    if (ok) {
      res = await doFetch();
    } else {
      redirectToLogin("expired");
      throw new ApiError(401, null);
    }
  }

  if (res.status === 401 && !skipAuth) {
    redirectToLogin("expired");
    throw new ApiError(401, null);
  }

  if (!res.ok) throw await toApiError(res);

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Turn a non-OK response into the typed ApiError, honouring reuse redirect. */
async function toApiError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    body = null;
  }
  if (body?.error?.code === "refresh_token_reuse") {
    redirectToLogin("reused");
  }
  return new ApiError(res.status, body);
}

/**
 * Multipart/form-data sibling of `api` (file uploads). Content-Type is left
 * unset so the browser adds the boundary. Same token-attach, single-flight
 * refresh-replay and error-envelope behaviour as `api`.
 */
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const doFetch = () => {
    const token = tokenStore.getAccess();
    return fetch(`${BASE_URL}${path}`, {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  };

  let res = await doFetch();

  if (res.status === 401 && tokenStore.getRefresh()) {
    refreshing ??= tryRefresh();
    const ok = await refreshing;
    refreshing = null;

    if (ok) {
      res = await doFetch();
    } else {
      redirectToLogin("expired");
      throw new ApiError(401, null);
    }
  }

  if (res.status === 401) {
    redirectToLogin("expired");
    throw new ApiError(401, null);
  }

  if (!res.ok) throw await toApiError(res);
  return (await res.json()) as T;
}
