// API client over the shared OpenAPI contract.
//
// Ported from mobile/src/lib/api.ts and deliberately kept close to it: same
// HTTPError shape, same 15s timeout, same single 401 refresh-retry, same
// X-Ledger-Id injection. What differs is the two things that are actually
// platform-specific — there is no SecureStore (the access token lives in a
// module variable, the refresh token in an httpOnly cookie), and every request
// sends credentials so that cookie rides along.
//
// src/lib/api-types.ts is generated from the contract by `yarn gen`; never
// hand-edit it.

import createClient, { type Middleware } from "openapi-fetch";

import type { components, paths } from "./api-types";
import { activeLedgerId } from "./ledger-store";

type S = components["schemas"];

export type { paths };
export type User = S["User"];
export type AuthResponse = S["AuthResponse"];
export type ApiError = S["Error"];
export type AccountType = S["AccountType"];
export type Account = S["Account"];
export type JournalLine = S["JournalLine"];
export type DC = NonNullable<S["JournalLine"]["dc"]>;
export type Entry = S["Entry"];
export type AccountBalance = S["AccountBalance"];
export type BudgetWithSpent = S["BudgetWithSpent"];
export type NetWorth = S["NetWorth"];
export type CategorySpend = S["CategorySpend"];
export type CashFlow = S["CashFlow"];
export type MonthlySeries = S["MonthlySeries"];
export type MonthlyPoint = S["MonthlyPoint"];
export type RecurringRule = S["RecurringRule"];
export type RecurringTemplate = S["RecurringTemplate"];
export type FxRate = S["FxRate"];
export type FxRateList = S["FxRateList"];
export type Ledger = S["Ledger"];
export type LedgerMembership = S["LedgerMembership"];
export type LedgerMember = S["LedgerMember"];
export type LedgerRole = S["LedgerRole"];
export type LedgerInvite = S["LedgerInvite"];

// Same origin, always: the SPA is served next to the API behind a proxy that
// maps /api → the Go server (vite.config.ts does the same in dev). That is what
// lets the refresh cookie be SameSite=Lax with no CORS and no CSRF token.
const BASE_URL = "/api";

export class HTTPError extends Error {
  status: number;
  body: ApiError | null;
  constructor(status: number, body: ApiError | null) {
    super(body?.message ?? `request failed (${status})`);
    this.status = status;
    this.body = body;
  }
}

// --- access token -----------------------------------------------------------
// In memory only. localStorage would mean one XSS is a permanent account
// takeover; a reload instead re-derives a token from the httpOnly refresh
// cookie, which script cannot read.

let accessToken = "";
let refreshing: Promise<string> | null = null;

export function setAccessToken(token: string): void {
  accessToken = token;
}

export function getAccessToken(): string {
  return accessToken;
}

/**
 * Exchange the refresh cookie for a fresh access token.
 *
 * Concurrent callers share one in-flight request: refresh tokens rotate, so two
 * parallel refreshes would race and one of them would present an already-spent
 * token — which the server correctly treats as replay and rejects, logging the
 * user out mid-session.
 */
export function refreshAccessToken(): Promise<string> {
  if (!refreshing) {
    refreshing = rawRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function rawRefresh(): Promise<string> {
  // Empty body: the token comes from the fa_refresh cookie the browser sends.
  const res = await client.POST("/auth/refresh", { body: {} });
  // Only a 401 means "no valid cookie". Collapsing a 500 into the same empty
  // string would tell the boot path a signed-in user is signed out.
  if (res.error !== undefined || !res.data) {
    accessToken = "";
    if (res.response.status === 401) return "";
    throw new HTTPError(res.response.status, isApiError(res.error) ? res.error : null);
  }
  accessToken = res.data.access_token;
  return accessToken;
}

// --- client -----------------------------------------------------------------

const TIMEOUT_MS = 15_000;

const client = createClient<paths>({
  baseUrl: BASE_URL,
  // The refresh cookie is same-origin, but being explicit keeps the intent
  // legible and survives a future move to a sibling host.
  credentials: "include",
  // `Request.signal` is never null — a Request always carries one — so a
  // `if (req.signal) return fetch(req)` guard would disable the timeout
  // entirely. Compose instead: whichever fires first wins, so a caller's own
  // signal (the health poll) still cancels, and every request still has a
  // ceiling rather than hanging until the browser gives up.
  fetch: (req: Request) =>
    fetch(req, { signal: AbortSignal.any([req.signal, AbortSignal.timeout(TIMEOUT_MS)]) }),
});

// Every authed call carries the bearer and the active book. Doing it in one
// middleware rather than at each call site is what makes "switch book" a
// one-line change instead of an audit of twenty endpoints, and what stops a new
// endpoint from silently reading the personal book while the UI shows a shared
// one.
const authMiddleware: Middleware = {
  onRequest({ request }) {
    if (accessToken) request.headers.set("Authorization", `Bearer ${accessToken}`);
    const ledgerId = activeLedgerId();
    if (ledgerId) request.headers.set("X-Ledger-Id", ledgerId);
    return request;
  },
};
client.use(authMiddleware);

function isApiError(v: unknown): v is ApiError {
  return !!v && typeof v === "object" && "code" in v && "message" in v;
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

// openapi-fetch hands non-2xx back as `{ error }` rather than throwing; the rest
// of the app expects an HTTPError. 204 → void. A non-JSON error body (proxy
// HTML on a 5xx) has no `code`, so it surfaces status-only instead of crashing.
function unwrap<T>(r: FetchResult<T>): T {
  if (r.response.status === 204) return undefined as T;
  if (r.error !== undefined) {
    throw new HTTPError(r.response.status, isApiError(r.error) ? r.error : null);
  }
  return r.data as T;
}

/**
 * Run an authed call, refreshing once on a 401 and retrying.
 *
 * The access token is short-lived by design, so a 401 mid-session is the normal
 * case, not an error worth surfacing. Only a failed refresh is a real logout.
 */
async function authed<T>(call: () => Promise<FetchResult<T>>): Promise<T> {
  const first = await call();
  if (first.response.status !== 401) return unwrap(first);

  const fresh = await refreshAccessToken();
  if (!fresh) return unwrap(first); // refresh failed — surface the original 401
  return unwrap(await call());
}

// --- unauthenticated surface ------------------------------------------------

export const api = {
  health: (signal?: AbortSignal) => client.GET("/healthz", { signal }).then(unwrap),

  register: (email: string, password: string, baseCurrency?: string) =>
    client
      .POST("/auth/register", { body: { email, password, base_currency: baseCurrency } })
      .then(unwrap),

  login: (email: string, password: string) =>
    client.POST("/auth/login", { body: { email, password } }).then(unwrap),

  google: (code: string, redirectUri: string) =>
    client.POST("/auth/google", { body: { code, redirect_uri: redirectUri } }).then(unwrap),

  // Answers 204 whether or not the address is registered — the UI must say
  // "if that address has an account…" and never confirm one exists.
  forgotPassword: (email: string) =>
    client.POST("/auth/password/forgot", { body: { email } }).then(unwrap),

  resetPassword: (email: string, code: string, password: string) =>
    client.POST("/auth/password/reset", { body: { email, code, password } }).then(unwrap),
};

// --- authenticated surface --------------------------------------------------

export const authedApi = {
  me: () => authed(() => client.GET("/auth/me")),

  // Empty body: the server revokes the token from the cookie and clears it.
  logout: () => authed(() => client.POST("/auth/logout", { body: {} })),

  listAccounts: (type?: AccountType) =>
    authed(() => client.GET("/accounts", { params: { query: { type } } })),

  listAccountBalances: () => authed(() => client.GET("/accounts/balances")),

  createAccount: (body: { type: AccountType; currency: string; name: string; parent_id?: string }) =>
    authed(() => client.POST("/accounts", { body })),

  updateAccount: (id: string, body: { name?: string; archived?: boolean }) =>
    authed(() => client.PATCH("/accounts/{id}", { params: { path: { id } }, body })),

  accountBalance: (id: string) =>
    authed(() => client.GET("/accounts/{id}/balance", { params: { path: { id } } })),

  // from/to are always supplied by the web client: /entries is unpaginated, and
  // with no local store there is nothing to soften a whole-book payload.
  listEntries: (from: string, to: string) =>
    authed(() => client.GET("/entries", { params: { query: { from, to } } })),

  getEntry: (id: string) => authed(() => client.GET("/entries/{id}", { params: { path: { id } } })),

  postEntry: (body: {
    currency: string;
    txn_date: string;
    memo?: string;
    fx_rate?: string;
    lines: { account_id: string; dc: DC; amount_minor: number; currency?: string }[];
  }) => authed(() => client.POST("/entries", { body })),

  updateEntry: (id: string, memo: string) =>
    authed(() => client.PATCH("/entries/{id}", { params: { path: { id } }, body: { memo } })),

  deleteEntry: (id: string) =>
    authed(() => client.DELETE("/entries/{id}", { params: { path: { id } } })),

  listBudgets: (period: string) =>
    authed(() => client.GET("/budgets", { params: { query: { period } } })),

  setBudget: (accountId: string, periodMonth: string, targetMinor: number) =>
    authed(() =>
      client.POST("/budgets", {
        body: { account_id: accountId, period_month: periodMonth, target_minor: targetMinor },
      }),
    ),

  updateBudget: (id: string, targetMinor: number) =>
    authed(() =>
      client.PUT("/budgets/{id}", { params: { path: { id } }, body: { target_minor: targetMinor } }),
    ),

  deleteBudget: (id: string) =>
    authed(() => client.DELETE("/budgets/{id}", { params: { path: { id } } })),

  getNetWorth: () => authed(() => client.GET("/reports/net-worth")),

  getSpending: (from: string, to: string) =>
    authed(() => client.GET("/reports/spending", { params: { query: { from, to } } })),

  getCashFlow: (from: string, to: string) =>
    authed(() => client.GET("/reports/cash-flow", { params: { query: { from, to } } })),

  getMonthlySeries: (months = 6) =>
    authed(() => client.GET("/reports/monthly", { params: { query: { months } } })),

  listRecurring: () => authed(() => client.GET("/recurring")),

  createRecurring: (rrule: string, template: RecurringTemplate, active = true) =>
    authed(() => client.POST("/recurring", { body: { rrule, template, active } })),

  updateRecurring: (id: string, rrule: string, template: RecurringTemplate, active: boolean) =>
    authed(() =>
      client.PUT("/recurring/{id}", { params: { path: { id } }, body: { rrule, template, active } }),
    ),

  deleteRecurring: (id: string) =>
    authed(() => client.DELETE("/recurring/{id}", { params: { path: { id } } })),

  triggerRecurring: () => authed(() => client.POST("/recurring/trigger")),

  listFxRates: () => authed(() => client.GET("/fx/rates")),

  // --- books (ledgers) ---
  // These target a book by path id rather than the active-book header: you
  // manage a book from wherever you are, without switching into it first.
  listLedgers: () => authed(() => client.GET("/ledgers")),

  createLedger: (name: string, baseCurrency?: string) =>
    authed(() =>
      client.POST("/ledgers", {
        body: { name, ...(baseCurrency ? { base_currency: baseCurrency } : {}) },
      }),
    ),

  listLedgerMembers: (id: string) =>
    authed(() => client.GET("/ledgers/{id}/members", { params: { path: { id } } })),

  removeLedgerMember: (id: string, userId: string) =>
    authed(() =>
      client.DELETE("/ledgers/{id}/members/{userId}", { params: { path: { id, userId } } }),
    ),

  createLedgerInvite: (id: string) =>
    authed(() => client.POST("/ledgers/{id}/invite", { params: { path: { id } } })),

  joinLedger: (code: string) => authed(() => client.POST("/ledgers/join", { body: { code } })),
};
