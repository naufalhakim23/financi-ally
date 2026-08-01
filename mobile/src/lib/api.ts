// API client built on the shared OpenAPI contract. openapi-fetch gives
// typed paths via createClient<paths>(); this module wraps it to preserve the
// original surface (api / authedApi / HTTPError + type re-exports) and the
// behaviors the app relies on (15s default timeout, defensive non-JSON
// handling, single 401 refresh-retry).
//
// Single source of truth: src/lib/api-types.ts is generated from
// ../shared-context/contracts/openapi.yaml by `npm run gen` (and the root
// `make generate-contract` regenerates both BE and FE). Re-run it after
// editing the contract — never hand-edit api-types.ts.

import createClient from "openapi-fetch";

import type { components, paths } from "./api-types";
import { activeLedgerId, clearActiveLedger, markLedgerStale } from "./ledgerStore";

type S = components["schemas"];

// --- type re-exports: named schema components from the contract ---
export type { paths };
export type HealthStatus = S["HealthStatus"];
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
export type SyncTableChanges = S["SyncTableChanges"];
export type SyncChanges = S["SyncChanges"];
export type SyncRecord = NonNullable<SyncTableChanges["created"]>[number];
export type SyncPullResponse = S["SyncPullResponse"];
export type SyncPushRequest = S["SyncPushRequest"];
export type SyncPushResponse = S["SyncPushResponse"];
export type Ledger = S["Ledger"];
export type LedgerMembership = S["LedgerMembership"];
export type LedgerMember = S["LedgerMember"];
export type LedgerRole = S["LedgerRole"];
export type LedgerInvite = S["LedgerInvite"];

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

// openapi-fetch hands non-2xx back as `{ error }` instead of throwing; the rest
// of the app expects an HTTPError, so unwrap translates. 204 → void. A non-JSON
// error body (proxy HTML on a 5xx) has no `code`, so it surfaces as a
// status-only HTTPError rather than crashing on a JSON.parse.
type FetchResult<T> = { data?: T; error?: unknown; response: Response };

function isApiError(v: unknown): v is ApiError {
  return !!v && typeof v === "object" && "code" in v && "message" in v;
}

async function unwrap<T>(r: FetchResult<T>): Promise<T> {
  if (r.response.status === 204) return undefined as T;
  if (r.error !== undefined) {
    throw new HTTPError(r.response.status, isApiError(r.error) ? r.error : null);
  }
  return r.data as T;
}

// Every authed call carries the active book. Setting it here rather than at
// each call site is what makes "switch ledger" a one-line change instead of an
// audit of 20 endpoints, and what stops a new endpoint from silently reading
// the personal book while the UI shows a household.
function authHdr(accessToken: string): Record<string, string> {
  const ledgerId = activeLedgerId();
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(ledgerId ? { "X-Ledger-Id": ledgerId } : {}),
  };
}

// 15s ceiling so a stalled network can't leave the UI spinning forever. If the
// caller already supplied a signal (e.g. the health poll), it wins. openapi-fetch
// hands the built Request here, so read the signal off it.
const client = createClient<paths>({
  baseUrl: BASE_URL,
  fetch: (req: Request) => {
    if (req.signal) return fetch(req);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 15000);
    return fetch(new Request(req, { signal: ctrl.signal })).finally(() => clearTimeout(timeout));
  },
});

// Unauthed surface used by the auth provider (src/lib/auth.tsx owns tokens and
// passes them in explicitly here).
export const api = {
  health: (signal?: AbortSignal) => client.GET("/healthz", { signal }).then(unwrap),

  register: (email: string, password: string, baseCurrency?: string) =>
    client.POST("/auth/register", { body: { email, password, base_currency: baseCurrency } }).then(unwrap),

  login: (email: string, password: string) =>
    client.POST("/auth/login", { body: { email, password } }).then(unwrap),

  refresh: (refreshToken: string) =>
    client.POST("/auth/refresh", { body: { refresh_token: refreshToken } }).then(unwrap),

  google: (code: string, redirectUri: string) =>
    client.POST("/auth/google", { body: { code, redirect_uri: redirectUri } }).then(unwrap),

  // Answers 204 whether or not the address is registered — the UI must say
  // "if that address has an account…" and never confirm one exists.
  forgotPassword: (email: string) =>
    client.POST("/auth/password/forgot", { body: { email } }).then(unwrap),

  resetPassword: (email: string, code: string, password: string) =>
    client.POST("/auth/password/reset", { body: { email, code, password } }).then(unwrap),

  me: (accessToken: string) => client.GET("/auth/me", { headers: authHdr(accessToken) }).then(unwrap),

  logout: (accessToken: string, refreshToken: string) =>
    client
      .POST("/auth/logout", { headers: authHdr(accessToken), body: { refresh_token: refreshToken } })
      .then(unwrap),
};

// Kept for the M0 health smoke screen; the gated home screen drops the poll.
export const getHealth = (signal?: AbortSignal) => api.health(signal);

// Authed wrapper: injects the bearer from the auth bridge and, on a 401,
// refreshes once and retries — generalizing the hydration path to every authed
// call. The mobile reads/writes via WatermelonDB locally and reconciles through
// sync; these REST methods cover direct reads + the sync endpoints.
async function withAuthRetry<T>(call: (token: string) => Promise<T>): Promise<T> {
  const { getAuthAccessors } = await import("./authBridge");
  const accessors = getAuthAccessors();
  const token = accessors?.getAccessToken() ?? "";
  try {
    return await call(token);
  } catch (e) {
    if (!(e instanceof HTTPError)) throw e;
    // The active book went away (an owner removed us, or the ledger was
    // deleted). Every request carries that header, so without dropping it the
    // app 403s forever, including the Books screen that would let the user fix
    // it. Fall back to the personal book, which every user always has.
    if (e.status === 403 && e.body?.code === "ledger_forbidden" && activeLedgerId()) {
      await clearActiveLedger();
      markLedgerStale();
      return await call(token);
    }
    if (e.status !== 401 || !accessors) throw e;
    const fresh = await accessors.refreshAccessToken();
    if (!fresh) throw e; // refresh failed; surface original 401
    return await call(fresh);
  }
}

export const authedApi = {
  listAccounts: (type?: AccountType) =>
    withAuthRetry((tok) =>
      client.GET("/accounts", { headers: authHdr(tok), params: { query: { type } } }).then(unwrap),
    ),

  accountBalance: (id: string) =>
    withAuthRetry((tok) =>
      client.GET("/accounts/{id}/balance", { headers: authHdr(tok), params: { path: { id } } }).then(unwrap),
    ),

  listBudgets: (period: string) =>
    withAuthRetry((tok) =>
      client.GET("/budgets", { headers: authHdr(tok), params: { query: { period } } }).then(unwrap),
    ),

  setBudget: (accountId: string, periodMonth: string, targetMinor: number, id?: string) =>
    withAuthRetry((tok) =>
      client.POST("/budgets", {
        headers: authHdr(tok),
        body: { account_id: accountId, period_month: periodMonth, target_minor: targetMinor, ...(id ? { id } : {}) },
      }).then(unwrap),
    ),

  updateBudget: (id: string, targetMinor: number) =>
    withAuthRetry((tok) =>
      client.PUT("/budgets/{id}", {
        headers: authHdr(tok),
        params: { path: { id } },
        body: { target_minor: targetMinor },
      }).then(unwrap),
    ),

  deleteBudget: (id: string) =>
    withAuthRetry((tok) =>
      client.DELETE("/budgets/{id}", {
        headers: authHdr(tok),
        params: { path: { id } },
      }).then(unwrap),
    ),

  getNetWorth: () =>
    withAuthRetry((tok) =>
      client.GET("/reports/net-worth", { headers: authHdr(tok) }).then(unwrap),
    ),

  getSpending: (from: string, to: string) =>
    withAuthRetry((tok) =>
      client.GET("/reports/spending", { headers: authHdr(tok), params: { query: { from, to } } }).then(unwrap),
    ),

  getCashFlow: (from: string, to: string) =>
    withAuthRetry((tok) =>
      client.GET("/reports/cash-flow", { headers: authHdr(tok), params: { query: { from, to } } }).then(unwrap),
    ),

  getMonthlySeries: (months = 6) =>
    withAuthRetry((tok) =>
      client.GET("/reports/monthly", { headers: authHdr(tok), params: { query: { months } } }).then(unwrap),
    ),

  listRecurring: () =>
    withAuthRetry((tok) =>
      client.GET("/recurring", { headers: authHdr(tok) }).then(unwrap),
    ),

  createRecurring: (rrule: string, template: RecurringTemplate, active = true) =>
    withAuthRetry((tok) =>
      client.POST("/recurring", { headers: authHdr(tok), body: { rrule, template, active } }).then(unwrap),
    ),

  updateRecurring: (id: string, rrule: string, template: RecurringTemplate, active: boolean) =>
    withAuthRetry((tok) =>
      client.PUT("/recurring/{id}", {
        headers: authHdr(tok),
        params: { path: { id } },
        body: { rrule, template, active },
      }).then(unwrap),
    ),

  deleteRecurring: (id: string) =>
    withAuthRetry((tok) =>
      client.DELETE("/recurring/{id}", { headers: authHdr(tok), params: { path: { id } } }).then(unwrap),
    ),

  // Materializes the caller's due rules now instead of waiting for the server's
  // next sweep — what the "Run due now" action calls.
  triggerRecurring: () =>
    withAuthRetry((tok) =>
      client.POST("/recurring/trigger", { headers: authHdr(tok) }).then(unwrap),
    ),

  listFxRates: () =>
    withAuthRetry((tok) =>
      client.GET("/fx/rates", { headers: authHdr(tok) }).then(unwrap),
    ),

  // --- ledgers (books) ---
  // These target a book by path id rather than the active-book header: you
  // manage a ledger from wherever you are, without switching into it first.

  listLedgers: () =>
    withAuthRetry((tok) =>
      client.GET("/ledgers", { headers: authHdr(tok) }).then(unwrap),
    ),

  createLedger: (name: string, baseCurrency?: string) =>
    withAuthRetry((tok) =>
      client.POST("/ledgers", {
        headers: authHdr(tok),
        body: { name, ...(baseCurrency ? { base_currency: baseCurrency } : {}) },
      }).then(unwrap),
    ),

  listLedgerMembers: (id: string) =>
    withAuthRetry((tok) =>
      client.GET("/ledgers/{id}/members", { headers: authHdr(tok), params: { path: { id } } }).then(unwrap),
    ),

  removeLedgerMember: (id: string, userId: string) =>
    withAuthRetry((tok) =>
      client.DELETE("/ledgers/{id}/members/{userId}", {
        headers: authHdr(tok),
        params: { path: { id, userId } },
      }).then(unwrap),
    ),

  createLedgerInvite: (id: string) =>
    withAuthRetry((tok) =>
      client.POST("/ledgers/{id}/invite", { headers: authHdr(tok), params: { path: { id } } }).then(unwrap),
    ),

  joinLedger: (code: string) =>
    withAuthRetry((tok) =>
      client.POST("/ledgers/join", { headers: authHdr(tok), body: { code } }).then(unwrap),
    ),

  syncPull: (lastPulledAt: number) =>
    withAuthRetry((tok) =>
      client.GET("/sync/pull", { headers: authHdr(tok), params: { query: { last_pulled_at: lastPulledAt } } }).then(unwrap),
    ),

  syncPush: (changes: SyncChanges) =>
    withAuthRetry((tok) =>
      client.POST("/sync/push", { headers: authHdr(tok), body: { changes } }).then(unwrap),
    ),
};
