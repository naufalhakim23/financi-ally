import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { monthKey } from "@financially/domain/ledger";

import { authedApi, type AccountType, type DC } from "./api";
import { linesOf, toDomainAccount, toDomainBudget, toDomainEntry, toRateTable } from "./adapters";
import { activeLedgerId } from "./ledger-store";
import { qk, queryClient } from "./query";

// What `useObservable(query.observe())` becomes on the web.
//
// The mobile app watches local tables and lets WatermelonDB push changes; here
// a mutation invalidates the keys it touched and the server answers again.
// Every hook returns the raw contract objects *and* the domain-shaped records,
// because screens need both — the id and timestamps for routing, the domain
// records for the money math the two clients share.

/** The month a screen is looking at, as the `YYYY-MM-01` the API expects. */
export function periodOf(date: Date): string {
  return `${monthKey(date)}-01`;
}

/** First and last day of `date`'s month, as `YYYY-MM-DD`. */
export function monthRange(date: Date): { from: string; to: string } {
  const y = date.getFullYear();
  const m = date.getMonth();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
}

/**
 * How far back the screens that derive figures from entries look.
 *
 * One constant, not a per-screen number: the dashboard and the pockets list
 * both walk the same lines, so a different window on each screen means the same
 * account shows two different balances depending on where you look at it.
 * Sharing it also means they share a query key, so it is one request, not two.
 */
export const BOOK_WINDOW_MONTHS = 24;

/**
 * A rolling window ending today, as `YYYY-MM-DD`.
 *
 * The dashboard always passes a range: GET /entries is unpaginated and this
 * client has no local store, so an unbounded fetch would download an entire
 * book to render one screen.
 */
export function rollingRange(months: number, now = new Date()): { from: string; to: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return { from: iso(from), to: iso(now) };
}

// --- reads ------------------------------------------------------------------

export function useAccounts(type?: AccountType) {
  const ledgerId = activeLedgerId();
  const query = useQuery({
    queryKey: [...qk.accounts(ledgerId), type ?? "all"],
    queryFn: () => authedApi.listAccounts(type),
  });
  const accounts = useMemo(() => (query.data ?? []).map(toDomainAccount), [query.data]);
  return { ...query, accounts };
}

export function useEntries(from: string, to: string) {
  const ledgerId = activeLedgerId();
  const query = useQuery({
    queryKey: qk.entries(ledgerId, from, to),
    queryFn: () => authedApi.listEntries(from, to),
  });
  const domain = useMemo(() => {
    const raw = query.data ?? [];
    return { entries: raw.map(toDomainEntry), lines: linesOf(raw) };
  }, [query.data]);
  return { ...query, ...domain };
}

export function useEntry(id: string) {
  const ledgerId = activeLedgerId();
  return useQuery({
    queryKey: qk.entry(ledgerId, id),
    queryFn: () => authedApi.getEntry(id),
    enabled: !!id,
  });
}

export function useBudgets(period: string) {
  const ledgerId = activeLedgerId();
  const query = useQuery({
    queryKey: qk.budgets(ledgerId, period),
    queryFn: () => authedApi.listBudgets(period),
  });
  const budgets = useMemo(() => (query.data ?? []).map(toDomainBudget), [query.data]);
  return { ...query, budgets };
}

export function useFxRates() {
  const ledgerId = activeLedgerId();
  const query = useQuery({
    queryKey: qk.fxRates(ledgerId),
    // Rates move once a day at most; refetching them per screen is wasted work.
    staleTime: 60 * 60 * 1000,
    queryFn: () => authedApi.listFxRates(),
  });
  const rates = useMemo(() => toRateTable(query.data), [query.data]);
  return { ...query, rates };
}

export function useMonthlySeries(months = 6) {
  const ledgerId = activeLedgerId();
  return useQuery({
    queryKey: qk.reportMonthly(ledgerId, months),
    queryFn: () => authedApi.getMonthlySeries(months),
  });
}

export function useNetWorth() {
  const ledgerId = activeLedgerId();
  return useQuery({
    queryKey: qk.reportNetWorth(ledgerId),
    queryFn: () => authedApi.getNetWorth(),
  });
}

// --- writes -----------------------------------------------------------------

/**
 * Drop every cached figure for the active book.
 *
 * Coarser than invalidating the exact keys a mutation touched, and deliberately
 * so: one posted entry moves two account balances, the month's spend, the
 * budget's progress, net worth and three reports. Enumerating that list is a
 * maintenance trap where the failure mode is a stale number on a finance
 * screen, and refetching a handful of small endpoints costs less than getting
 * it wrong.
 */
function invalidateBook() {
  return queryClient.invalidateQueries({ queryKey: qk.book(activeLedgerId()) });
}

export function usePostEntry() {
  return useMutation({
    mutationFn: authedApi.postEntry,
    // No optimistic update. An entry the server rejects as unbalanced would
    // otherwise show a balance that never existed — on a money screen, briefly
    // wrong is worse than briefly slow.
    onSuccess: invalidateBook,
  });
}

export function useDeleteEntry() {
  return useMutation({
    mutationFn: (id: string) => authedApi.deleteEntry(id),
    onSuccess: (_data, id) => {
      // Drop the deleted entry's own key rather than letting the blanket
      // invalidation refetch it — that refetch can only ever 404.
      queryClient.removeQueries({ queryKey: qk.entry(activeLedgerId(), id) });
      return invalidateBook();
    },
  });
}

export function useUpdateEntryMemo() {
  return useMutation({
    mutationFn: ({ id, memo }: { id: string; memo: string }) => authedApi.updateEntry(id, memo),
    onSuccess: invalidateBook,
  });
}

export function useCreateAccount() {
  return useMutation({
    mutationFn: (body: {
      type: AccountType;
      currency: string;
      name: string;
      parent_id?: string;
    }) => authedApi.createAccount(body),
    onSuccess: invalidateBook,
  });
}

export function useUpdateAccount() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; archived?: boolean }) =>
      authedApi.updateAccount(id, body),
    onSuccess: invalidateBook,
  });
}

export function useSetBudget() {
  return useMutation({
    mutationFn: ({
      accountId,
      period,
      targetMinor,
    }: {
      accountId: string;
      period: string;
      targetMinor: number;
    }) => authedApi.setBudget(accountId, period, targetMinor),
    onSuccess: invalidateBook,
  });
}

/** Re-export so screens don't reach past this module for the client. */
export { useQueryClient };
export type { DC };
