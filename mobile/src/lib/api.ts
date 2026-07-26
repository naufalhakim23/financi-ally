// API client. Pure functions; no token awareness. The auth provider
// (src/lib/auth.tsx) owns tokens and passes them in; this module only knows
// shapes and the base URL.

export type HealthStatus = { status: string; db: "up" | "down" };

export type User = {
  id: string;
  email: string;
  base_currency: string;
  created_at: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  user: User;
};

export type ApiError = { code: string; message: string };

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";

export class HTTPError extends Error {
  status: number;
  body: ApiError | null;
  constructor(status: number, body: ApiError | null) {
    super(body?.message ?? `request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  // 15s ceiling so a stalled network can't leave the UI spinning forever. If
  // the caller already supplied a signal (e.g. health poll), defer to it.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: init.signal ?? ctrl.signal,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timeout);
  }
  // 204 has no body; caller treats as void.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  // A proxy / 5xx can hand back HTML or plain text; JSON.parse would throw a
  // raw SyntaxError and callers would see that instead of an HTTPError. Parse
  // defensively: malformed body → null, and on !res.ok that surfaces as a
  // status-only HTTPError rather than a parse crash.
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    const body =
      parsed && typeof parsed === "object" && "code" in (parsed as object)
        ? (parsed as ApiError)
        : null;
    throw new HTTPError(res.status, body);
  }
  return parsed as T;
}

function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

export const api = {
  health: (signal?: AbortSignal) => req<HealthStatus>("/healthz", { signal }),

  register: (email: string, password: string, baseCurrency?: string) =>
    req<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, base_currency: baseCurrency }),
    }),

  login: (email: string, password: string) =>
    req<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    req<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  google: (code: string, redirectUri: string) =>
    req<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    }),

  me: (accessToken: string) => req<User>("/auth/me", { headers: authHeader(accessToken) }),

  logout: (accessToken: string, refreshToken: string) =>
    req<void>("/auth/logout", {
      method: "POST",
      headers: authHeader(accessToken),
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
};

// Kept for the M0 health smoke screen; the gated home screen drops the poll.
export const getHealth = (signal?: AbortSignal) => api.health(signal);
