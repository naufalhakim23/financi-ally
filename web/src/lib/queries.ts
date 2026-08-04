import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { monthKey } from "@financially/domain/ledger";

import { authedApi, type AccountType, type DC, type RecurringTemplate } from "./api";
import { linesOf, toDomainAccount, toDomainBudget, toDomainEntry, toRateTable } from "./adapters";
// Reads during render go through the hook so a book switch re-renders the
// screen; the mutation callbacks below run outside render and use the getter.
import { activeLedgerId, useActiveLedger } from "./ledger-store";
import { qk, queryClient } from "./query";

// What `useObservable(query.observe())` becomes on the web.
//
// The mobile app watches local tables and lets WatermelonDB push changes; here
// a mutation invalidates the keys it touched and the server answers again.
// Every hook returns the raw contract objects *and* the domain-shaped records,
// because screens need both, the id and timestamps for routing, the domain
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

export type Period = "week" | "month" | "year";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The `to` a /reports endpoint needs to include `day`.
 *
 * Every reporting query filters `txn_date < to` — half-open, unlike /entries,
 * which is inclusive. Passing today to a report therefore drops everything
 * posted today, which on a dashboard means the coffee you just recorded is
 * missing from this month's spend and nothing on screen says why.
 */
export function reportEndAfter(day: Date): string {
  return iso(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1));
}

/**
 * The range a period picker means, ending today.
 *
 * Never runs past today: a "this year" range ending 31 December would divide
 * income by months that have not happened, and a cash-flow figure covering
 * unlived time reads as a shortfall the user cannot act on.
 */
export function periodRange(period: Period, now = new Date()): { from: string; to: string } {
  const to = reportEndAfter(now);

  if (period === "year") return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
  if (period === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  // Weeks start Monday: Sunday is `getDay() === 0`, which would otherwise land
  // six days ahead of the week the user is actually in.
  const offset = (now.getDay() + 6) % 7;
  return { from: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)), to };
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
  const ledgerId = useActiveLedger();
  const query = useQuery({
    queryKey: [...qk.accounts(ledgerId), type ?? "all"],
    queryFn: () => authedApi.listAccounts(type),
  });
  const accounts = useMemo(() => (query.data ?? []).map(toDomainAccount), [query.data]);
  return { ...query, accounts };
}

/**
 * Whole-book balance per account, straight from the server.
 *
 * Not derived from `useEntries`: those lines cover a rolling window, so an
 * account whose history starts before it would show a balance missing
 * everything older.
 */
export function useAccountBalances() {
  const ledgerId = useActiveLedger();
  const query = useQuery({
    queryKey: qk.accountBalances(ledgerId),
    queryFn: () => authedApi.listAccountBalances(),
  });
  const byId = useMemo(
    () => new Map((query.data ?? []).map((b) => [b.account_id, b.signed_minor])),
    [query.data],
  );
  const balanceOf = useMemo(
    () => (account: { id: string }) => byId.get(account.id) ?? 0,
    [byId],
  );
  return { ...query, byId, balanceOf };
}

export function useEntries(from: string, to: string) {
  const ledgerId = useActiveLedger();
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
  const ledgerId = useActiveLedger();
  return useQuery({
    queryKey: qk.entry(ledgerId, id),
    queryFn: () => authedApi.getEntry(id),
    enabled: !!id,
  });
}

export function useBudgets(period: string) {
  const ledgerId = useActiveLedger();
  const query = useQuery({
    queryKey: qk.budgets(ledgerId, period),
    queryFn: () => authedApi.listBudgets(period),
  });
  const budgets = useMemo(() => (query.data ?? []).map(toDomainBudget), [query.data]);
  return { ...query, budgets };
}

export function useFxRates() {
  const ledgerId = useActiveLedger();
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
  const ledgerId = useActiveLedger();
  return useQuery({
    queryKey: qk.reportMonthly(ledgerId, months),
    queryFn: () => authedApi.getMonthlySeries(months),
  });
}

export function useNetWorth() {
  const ledgerId = useActiveLedger();
  return useQuery({
    queryKey: qk.reportNetWorth(ledgerId),
    queryFn: () => authedApi.getNetWorth(),
  });
}

export function useSpending(from: string, to: string) {
  const ledgerId = useActiveLedger();
  return useQuery({
    queryKey: qk.reportSpending(ledgerId, from, to),
    queryFn: () => authedApi.getSpending(from, to),
  });
}

export function useCashFlow(from: string, to: string) {
  const ledgerId = useActiveLedger();
  return useQuery({
    queryKey: qk.reportCashFlow(ledgerId, from, to),
    queryFn: () => authedApi.getCashFlow(from, to),
  });
}

export function useRecurring() {
  const ledgerId = useActiveLedger();
  return useQuery({
    queryKey: qk.recurring(ledgerId),
    queryFn: () => authedApi.listRecurring(),
  });
}

/**
 * The books this user belongs to.
 *
 * Not namespaced by the active book: membership is a property of the user, and
 * keying it per book would refetch the same list on every switch. A switch
 * clears the whole cache anyway, so this key refetches too, it just does not
 * accumulate one stale copy per book.
 */
export function useLedgers() {
  return useQuery({ queryKey: qk.ledgers, queryFn: () => authedApi.listLedgers() });
}

export function useLedgerMembers(id: string | null) {
  return useQuery({
    queryKey: qk.ledgerMembers(id ?? ""),
    queryFn: () => authedApi.listLedgerMembers(id as string),
    enabled: !!id,
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
    // otherwise show a balance that never existed, on a money screen, briefly
    // wrong is worse than briefly slow.
    onSuccess: invalidateBook,
  });
}

export function useDeleteEntry() {
  return useMutation({
    mutationFn: (id: string) => authedApi.deleteEntry(id),
    onSuccess: (_data, id) => {
      // Drop the deleted entry's own key rather than letting the blanket
      // invalidation refetch it, that refetch can only ever 404.
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

export function useUpdateBudget() {
  return useMutation({
    mutationFn: ({ id, targetMinor }: { id: string; targetMinor: number }) =>
      authedApi.updateBudget(id, targetMinor),
    onSuccess: invalidateBook,
  });
}

export function useDeleteBudget() {
  return useMutation({
    mutationFn: (id: string) => authedApi.deleteBudget(id),
    onSuccess: invalidateBook,
  });
}

type RuleInput = { rrule: string; template: RecurringTemplate; active?: boolean };

export function useSaveRecurring() {
  return useMutation({
    // One hook for create and edit: the only difference is whether an id
    // exists, and splitting it would duplicate the invalidation and the form's
    // error handling for no gain.
    mutationFn: ({ id, rrule, template, active = true }: RuleInput & { id?: string }) =>
      id
        ? authedApi.updateRecurring(id, rrule, template, active)
        : authedApi.createRecurring(rrule, template, active),
    onSuccess: invalidateBook,
  });
}

export function useDeleteRecurring() {
  return useMutation({
    mutationFn: (id: string) => authedApi.deleteRecurring(id),
    onSuccess: invalidateBook,
  });
}

export function useTriggerRecurring() {
  return useMutation({
    // Idempotent per occurrence on the server, so a double click cannot
    // double-post, but it does post money, so it still invalidates the book.
    mutationFn: () => authedApi.triggerRecurring(),
    onSuccess: invalidateBook,
  });
}

// --- books ------------------------------------------------------------------
// These invalidate the membership list rather than the book: creating or
// joining a book changes which books exist, not the figures in the one on
// screen. Removing a member is the same, the ledger's entries are unchanged.

function invalidateLedgers() {
  return queryClient.invalidateQueries({ queryKey: qk.ledgers });
}

export function useCreateLedger() {
  return useMutation({
    mutationFn: ({ name, baseCurrency }: { name: string; baseCurrency?: string }) =>
      authedApi.createLedger(name, baseCurrency),
    onSuccess: invalidateLedgers,
  });
}

export function useJoinLedger() {
  return useMutation({
    mutationFn: (code: string) => authedApi.joinLedger(code),
    onSuccess: invalidateLedgers,
  });
}

export function useCreateInvite() {
  return useMutation({ mutationFn: (id: string) => authedApi.createLedgerInvite(id) });
}

export function useRemoveMember() {
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      authedApi.removeLedgerMember(id, userId),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.ledgerMembers(id) });
      return invalidateLedgers();
    },
  });
}

/** Re-export so screens don't reach past this module for the client. */
export { useQueryClient };
export type { DC };
