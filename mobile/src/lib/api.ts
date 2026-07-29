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

// --- ledger / budget / sync types (mirror backend openapi.yaml) ---

export type AccountType = "asset" | "liability" | "income" | "expense" | "equity";
export type DC = "debit" | "credit";

export type Account = {
  id: string;
  type: AccountType;
  currency: string;
  name: string;
  parent_id: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type JournalLine = {
  id: string;
  entry_id: string;
  account_id: string;
  dc: DC;
  amount_minor: number;
  currency: string;
};

export type Entry = {
  id: string;
  txn_date: string; // ISO date
  status: "draft" | "posted";
  currency: string;
  fx_rate: string | null;
  source: "manual" | "recurring" | "import";
  memo: string;
  lines: JournalLine[];
  created_at: string;
  updated_at: string;
};

export type AccountBalance = {
  account_id: string;
  currency: string;
  debit_minor: number;
  credit_minor: number;
  signed_minor: number;
};

export type BudgetWithSpent = {
  id: string;
  account_id: string;
  period_month: string; // ISO date
  target_minor: number;
  spent_minor: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

// WatermelonDB change-set shapes.
export type SyncRecord = Record<string, unknown>;
export type SyncTableChanges = {
  created?: SyncRecord[];
  updated?: SyncRecord[];
  deleted?: string[];
};
export type SyncChanges = Record<string, SyncTableChanges>;
export type SyncPullResponse = { changes: SyncChanges; timestamp: number };
export type SyncPushRequest = { changes: SyncChanges };
export type SyncPushResponse = { errors?: Record<string, string> };

// reqAuthed is the token-aware fetcher. It injects the bearer from the auth
// bridge and, on a 401, refreshes once and retries — generalizing the hydration
// path to every authed call. Returns the parsed JSON (or undefined for 204).
async function reqAuthed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { getAuthAccessors } = await import("./authBridge");
  const accessors = getAuthAccessors();
  const token = accessors?.getAccessToken();
  const headers = token
    ? { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) }
    : init.headers ?? {};
  try {
    return await req<T>(path, { ...init, headers });
  } catch (e) {
    if (!(e instanceof HTTPError) || e.status !== 401 || !accessors) throw e;
    const fresh = await accessors.refreshAccessToken();
    if (!fresh) throw e; // refresh failed; surface original 401
    return await req<T>(path, { ...init, headers: { ...headers, Authorization: `Bearer ${fresh}` } });
  }
}

// Authed API surface for the feature screens. The mobile writes/reads via
// WatermelonDB locally and reconciles through sync; these REST methods cover
// direct reads + the sync endpoints.
export const authedApi = {
  listAccounts: (type?: AccountType) =>
    reqAuthed<Account[]>(`/accounts${type ? `?type=${type}` : ""}`),
  accountBalance: (id: string) => reqAuthed<AccountBalance>(`/accounts/${id}/balance`),
  listBudgets: (period: string) => reqAuthed<BudgetWithSpent[]>(`/budgets?period=${period}`),
  syncPull: (lastPulledAt: number) =>
    reqAuthed<SyncPullResponse>(`/sync/pull?last_pulled_at=${lastPulledAt}`),
  syncPush: (changes: SyncChanges) =>
    reqAuthed<SyncPushResponse>("/sync/push", {
      method: "POST",
      body: JSON.stringify({ changes }),
    }),
};

