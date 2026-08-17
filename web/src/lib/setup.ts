import { useCallback, useEffect, useMemo, useState } from "react";

import { selectedItems } from "@financially/domain/starter";

import { HTTPError, authedApi, type AccountType } from "./api";
import { BOOK_WINDOW_MONTHS, rollingRange, useAccounts, useEntries, useQueryClient } from "./queries";
import { activeLedgerId, useActiveLedger } from "./ledger-store";
import { qk } from "./query";

// First-run setup state, derived rather than stored.
//
// There is no `onboarded` flag on the server and deliberately none here: the
// questions the checklist asks ("do you have a pocket yet?") are answered by
// the accounts and entries the app already fetches, so the state cannot desync
// from reality, survives a reinstall, and is the same on every device.
//
// The one exception is the manual dismissal below, which is a preference the
// data cannot express.

const DISMISS_PREFIX = "financially:setup-dismissed";
const SKIPPED_KEY = "financially:setup-skipped";

// Per book, not global: a freshly created shared book is empty and needs the
// checklist even though the personal one dismissed it months ago.
function dismissKey(): string {
  return `${DISMISS_PREFIX}:${activeLedgerId() ?? "personal"}`;
}

/**
 * Whether this book already waved the checklist away.
 *
 * Exported for the empty-ledger guard: dismissing the card is the same answer
 * as skipping the wizard, only a lasting one, so a book kept deliberately empty
 * must not be marched back into onboarding every new session.
 */
export function setupDismissed(): boolean {
  return readDismissed();
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(dismissKey()) === "1";
  } catch {
    return false;
  }
}

/**
 * Drop every dismissal on sign-out.
 *
 * localStorage outlives the session, so without this the next user on the same
 * browser inherits the previous one's "I already dealt with that" and never
 * sees the checklist their empty ledger was built for.
 */
export function clearSetupState() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DISMISS_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.removeItem(SKIPPED_KEY);
  } catch {
    // Storage refusal only costs the card reappearing, which is the safe side.
  }
}

/**
 * Whether this session already said no to the wizard.
 *
 * Without it the layout guard sends an empty ledger straight back to the wizard
 * the moment Skip lands on the dashboard, which is a loop, not a skip. Session
 * scope on purpose: it is not a lasting preference, just "I already answered
 * that", and the checklist keeps offering the same work either way.
 */
export function setupSkipped(): boolean {
  try {
    return sessionStorage.getItem(SKIPPED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSetupSkipped() {
  try {
    sessionStorage.setItem(SKIPPED_KEY, "1");
  } catch {
    // Private-mode storage refusal only costs one extra bounce into the wizard.
  }
}

export type SetupItem = {
  key: "pocket" | "category" | "income" | "entry";
  label: string;
  hint: string;
  done: boolean;
};

export function useSetupState() {
  const accountsQ = useAccounts();
  const window = useMemo(() => rollingRange(BOOK_WINDOW_MONTHS), []);
  const entriesQ = useEntries(window.from, window.to);

  const ledgerId = useActiveLedger();
  const [dismissed, setDismissed] = useState(readDismissed);
  // The key is per book and switching books does not remount this hook.
  useEffect(() => setDismissed(readDismissed()), [ledgerId]);

  const accounts = accountsQ.accounts;
  const has = (type: string) => accounts.some((a) => a.type === type);

  // An opening balance posts a real entry against equity, so counting every
  // entry would tick "record your first entry" for someone who has recorded
  // nothing but the money that was already in their pocket. Equity is the whole
  // test: an entry that arrived by import or by a recurring rule is still the
  // user's numbers moving, and filtering on source left those ledgers stuck at
  // three of four forever.
  const hasEntry = useMemo(() => {
    const equity = new Set(accounts.filter((a) => a.type === "equity").map((a) => a.id));
    return (entriesQ.data ?? []).some((e) => !e.lines.some((l) => equity.has(l.account_id)));
  }, [accounts, entriesQ.data]);

  const items: SetupItem[] = [
    {
      key: "pocket",
      label: "Add a pocket",
      hint: "cash, bank, e-wallet",
      done: has("asset") || has("liability"),
    },
    { key: "category", label: "Add a category", hint: "what you spend on", done: has("expense") },
    { key: "income", label: "Add an income source", hint: "where money comes from", done: has("income") },
    { key: "entry", label: "Record your first entry", hint: "and the numbers start moving", done: hasEntry },
  ];

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(dismissKey(), "1");
    } catch {
      // A browser that refuses storage still gets the dismissal for this session.
    }
    setDismissed(true);
  }, []);

  return {
    items,
    done: items.filter((i) => i.done).length,
    complete: items.every((i) => i.done),
    dismissed,
    dismiss,
    // Success, not "not pending". Both hooks fall back to an empty array, so a
    // failed fetch is indistinguishable from a brand-new ledger by its data
    // alone — and telling someone with four years of history that they are 0 of
    // 4 set up, because their connection dropped, is worse than showing them
    // nothing.
    loading: !accountsQ.isSuccess || !entriesQ.isSuccess,
  };
}

export type SeedResult = { created: number; attempted: number; error: unknown };

/**
 * Create the picked starter accounts, one request at a time.
 *
 * Sequential rather than parallel, and never rolled back: a half-created chart
 * is recoverable from the checklist, whereas deleting an account that really
 * was created to tidy up a failure destroys something the user now owns.
 */
export function useSeedAccounts() {
  const queryClient = useQueryClient();

  return useCallback(
    async (selection: Set<string>, currency: string): Promise<SeedResult> => {
      const items = selectedItems(selection);
      let created = 0;
      let error: unknown = null;
      for (const item of items) {
        try {
          await authedApi.createAccount({
            type: item.type as AccountType,
            currency,
            name: item.name,
          });
          created += 1;
        } catch (e) {
          // 409 is "you already have one of these" — the wizard is reachable
          // after setup, so re-running it must be a no-op, not a failure.
          if (e instanceof HTTPError && e.status === 409) {
            created += 1;
            continue;
          }
          error = e;
          break;
        }
      }
      if (created > 0) {
        // `refetchType: "all"`, not the default "active": the wizard renders
        // outside AppLayout, so the accounts query has no mounted observer
        // while it runs. The default would mark it stale and resolve without
        // fetching, and the empty-ledger guard would read that stale [] the
        // moment we navigate back and bounce the user into the wizard again.
        await queryClient.invalidateQueries({
          queryKey: qk.book(activeLedgerId()),
          refetchType: "all",
        });
      }
      return { created, attempted: items.length, error };
    },
    [queryClient],
  );
}
