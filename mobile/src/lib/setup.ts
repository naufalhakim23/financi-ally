import { useCallback, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { selectedItems } from "@financially/domain/starter";

import { database } from "./db";
import { activeLedgerId, useLedgerState } from "./ledgerStore";
import { syncDatabase } from "./sync";
import { Account, AccountType, Entry, JournalLine } from "../model/models";

// First-run setup state, derived from the local tables rather than stored.
//
// Nothing marks a ledger "onboarded": the questions the checklist asks are
// already answered by the accounts and entries on screen, so the state cannot
// desync, and it works identically for a guest with no server at all.
//
// Web has the same file over its query hooks. The catalog they seed from is
// shared; only the write differs, because this one has to work offline.

const DISMISS_KEY = "fa_setup_dismissed";

// Per book, not per install: a freshly joined shared book is empty and needs
// the checklist even though the personal one dismissed it months ago. One JSON
// map under one key rather than a key per ledger, because SecureStore cannot
// enumerate keys and sign-out has to drop every book's dismissal at once.
function dismissMap(): Record<string, boolean> {
  try {
    const raw = SecureStore.getItem(DISMISS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    // A keystore this hook cannot read is not a reason to take down the screen
    // it renders on. Undismissed is the safe answer.
    return {};
  }
}

/** "" is the personal book, the same identity api.ts sends as no header. */
function bookKey(): string {
  return activeLedgerId() || "personal";
}

function readDismissed(): boolean {
  return dismissMap()[bookKey()] === true;
}

/** Forget every dismissal on sign-out, so the next account starts its own setup. */
export function clearSetupState() {
  // Rejection swallowed, not awaited: worst case the card stays hidden for a
  // ledger that wanted it, and the wizard is still reachable from Buckets.
  SecureStore.deleteItemAsync(DISMISS_KEY).catch(() => {});
}

export type SetupItem = {
  key: "pocket" | "category" | "income" | "entry";
  label: string;
  hint: string;
  done: boolean;
};

/**
 * Derive the checklist from rows the caller already observes.
 *
 * Deliberately not its own observers: the only screen that renders this also
 * observes accounts, entries and journal_lines, and subscribing again made the
 * hottest screen in the app materialise the whole lines table twice.
 */
export function useSetupState(accounts: Account[], entries: Entry[], lines: JournalLine[]) {
  const activeId = useLedgerState().active?.id ?? "";
  const [dismissed, setDismissed] = useState(readDismissed);

  // Switching books keeps this hook mounted, so the flag has to be re-read for
  // the book that is now on screen.
  useEffect(() => {
    setDismissed(readDismissed());
  }, [activeId]);

  const has = (type: string) => accounts.some((a) => a.type === type);

  // An opening balance is a real entry against equity, so counting every entry
  // would tick "record your first entry" for someone who has recorded nothing
  // but the money that was already in their pocket. Equity is the whole test:
  // an entry that arrived by import or by a recurring rule is still the user's
  // numbers moving.
  const hasEntry = useMemo(() => {
    const equity = new Set(accounts.filter((a) => a.type === "equity").map((a) => a.id));
    const touchesEquity = new Set(
      lines.filter((l) => equity.has(l.accountId)).map((l) => l.entryId),
    );
    return entries.some((e) => !touchesEquity.has(e.id));
  }, [accounts, entries, lines]);

  const items: SetupItem[] = [
    {
      key: "pocket",
      label: "Add a pocket",
      hint: "cash, bank, e-wallet",
      done: has("asset") || has("liability"),
    },
    { key: "category", label: "Add a category", hint: "what you spend on", done: has("expense") },
    {
      key: "income",
      label: "Add an income source",
      hint: "where money comes from",
      done: has("income"),
    },
    {
      key: "entry",
      label: "Record your first entry",
      hint: "and the numbers start moving",
      done: hasEntry,
    },
  ];

  const dismiss = useCallback(() => {
    try {
      SecureStore.setItem(DISMISS_KEY, JSON.stringify({ ...dismissMap(), [bookKey()]: true }));
    } catch {
      // Storage refusal only costs the card reappearing next launch.
    }
    setDismissed(true);
  }, []);

  return {
    items,
    done: items.filter((i) => i.done).length,
    complete: items.every((i) => i.done),
    dismissed,
    dismiss,
  };
}

/**
 * Create the picked starter accounts locally, then push if there is a server.
 *
 * One `write` block, so a failure leaves no half-built chart — the local
 * database can do that transactionally where the web client's N POSTs cannot.
 */
export async function seedStarterAccounts(selection: Set<string>, currency: string) {
  // The wizard is reachable again after setup (it is the only way to add a
  // category on this client), so it must not recreate what is already there:
  // accounts are unique on (ledger, type, name) server-side, and a duplicate
  // would come back as a sync rejection long after the user had moved on.
  const existing = new Set(
    (await database.get<Account>("accounts").query().fetch()).map((a) => `${a.type}:${a.name}`),
  );
  const items = selectedItems(selection).filter((i) => !existing.has(`${i.type}:${i.name}`));
  if (items.length === 0) return;

  await database.write(async () => {
    for (const item of items) {
      await database.get<Account>("accounts").create((a) => {
        a.type = item.type as AccountType;
        a.currency = currency;
        a.name = item.name;
        a.parentId = null;
        a.archived = false;
      });
    }
  });

  try {
    await syncDatabase();
  } catch (e) {
    // Guest mode never syncs, and offline pushes next cycle. Neither is a
    // reason to fail a setup that already succeeded locally.
    console.warn("[setup] sync deferred", e);
  }
}
