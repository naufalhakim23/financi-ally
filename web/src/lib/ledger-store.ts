// The active book (ledger), as a module variable mirrored into localStorage.
//
// Every authed request carries it as X-Ledger-Id, so it has to be readable
// synchronously from the API client, hence the module variable. localStorage
// only makes the choice survive a reload; it holds no financial data, which is
// the whole premise of the online-only client.

import { useSyncExternalStore } from "react";

const KEY = "fa_active_ledger";

let active: string | null = readStored();
const listeners = new Set<() => void>();

function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    // Private browsing with storage disabled: the app still works, the book
    // choice just resets on reload.
    return null;
  }
}

/** The active ledger id, or null for "the personal book" (the server default). */
export function activeLedgerId(): string | null {
  return active;
}

export function setActiveLedger(id: string | null): void {
  active = id;
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // Non-fatal; see readStored.
  }
  for (const fn of listeners) fn();
}

/** Subscribe to book switches, used to clear the query cache. */
export function onLedgerChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The active ledger id, as reactive state.
 *
 * Components must read the book through this rather than calling
 * `activeLedgerId()` during render: that is a plain module getter, so a switch
 * updates the header every request carries while the screen that triggered it
 * keeps painting the old book's name and an "Active" tick on the wrong row.
 */
export function useActiveLedger(): string | null {
  return useSyncExternalStore(onLedgerChange, activeLedgerId, activeLedgerId);
}
