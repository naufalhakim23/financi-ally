import { QueryClient } from "@tanstack/react-query";

import { HTTPError } from "./api";

/**
 * The only cache in this client. There is no local database and no sync
 * protocol — a mutation invalidates what it touched and the server answers
 * again, which is what `useObservable(query.observe())` becomes on the web.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Money changes when the user changes it, not on a timer. A short stale
      // window keeps tab-switching cheap without ever showing a figure the
      // server has already contradicted.
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // 4xx means the request was wrong, not unlucky — retrying a 403 just
        // delays the error the user needs to see. Retry the rest twice.
        if (error instanceof HTTPError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      // Never automatically. A retried POST /entries could double-post money.
      retry: false,
    },
  },
});

/**
 * Query keys, in one place.
 *
 * Every money key starts with the active book so that switching books cannot
 * serve another book's numbers from cache — the single most dangerous stale
 * read this app can produce.
 */
export const qk = {
  ledgers: ["ledgers"] as const,
  ledgerMembers: (id: string) => ["ledgers", id, "members"] as const,
  book: (ledgerId: string | null) => ["book", ledgerId ?? "personal"] as const,
  accounts: (ledgerId: string | null) => [...qk.book(ledgerId), "accounts"] as const,
  accountBalances: (ledgerId: string | null) =>
    [...qk.book(ledgerId), "account-balances"] as const,
  entries: (ledgerId: string | null, from: string, to: string) =>
    [...qk.book(ledgerId), "entries", from, to] as const,
  entry: (ledgerId: string | null, id: string) => [...qk.book(ledgerId), "entry", id] as const,
  budgets: (ledgerId: string | null, period: string) =>
    [...qk.book(ledgerId), "budgets", period] as const,
  recurring: (ledgerId: string | null) => [...qk.book(ledgerId), "recurring"] as const,
  fxRates: (ledgerId: string | null) => [...qk.book(ledgerId), "fx"] as const,
  reportMonthly: (ledgerId: string | null, months: number) =>
    [...qk.book(ledgerId), "reports", "monthly", months] as const,
  reportSpending: (ledgerId: string | null, from: string, to: string) =>
    [...qk.book(ledgerId), "reports", "spending", from, to] as const,
  reportCashFlow: (ledgerId: string | null, from: string, to: string) =>
    [...qk.book(ledgerId), "reports", "cash-flow", from, to] as const,
  reportNetWorth: (ledgerId: string | null) =>
    [...qk.book(ledgerId), "reports", "net-worth"] as const,
};
