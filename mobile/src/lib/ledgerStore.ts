import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";

import type { Ledger } from "./api";

// Which book the app is currently reading and writing. A module store rather
// than a context, because api.ts is plain module code with no React and has to
// read this on every request to set the X-Ledger-Id header.
//
// The local WatermelonDB holds exactly one book's rows at a time (no ledger
// column, deliberately: a second tenancy key on-device is a second thing that
// can be wrong about money). Switching therefore wipes and re-pulls, which is
// why `switchLedger` lives in ledgers.ts next to the sync engine.

const ACTIVE_KEY = "fa_active_ledger";

export type LedgerState = {
  /** null means the personal book, the server's default when no header is sent. */
  active: Ledger | null;
};

let state: LedgerState = { active: null };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getLedgerState(): LedgerState {
  return state;
}

/**
 * The header value for the next request. Empty string means "no header", which
 * the server reads as the caller's personal book.
 */
export function activeLedgerId(): string {
  return state.active?.id ?? "";
}

/** Restores the persisted choice. Call once at startup, before the first sync. */
export async function hydrateLedger(): Promise<void> {
  try {
    const raw = await SecureStore.getItemAsync(ACTIVE_KEY);
    state = { active: raw ? (JSON.parse(raw) as Ledger) : null };
  } catch {
    // A corrupt or unreadable value must not block startup. Fall back to the
    // personal book, which every user always has.
    state = { active: null };
  }
  emit();
}

/** Records the active book. Persisted so a cold start opens the same one. */
export async function setActiveLedger(ledger: Ledger | null): Promise<void> {
  state = { ...state, active: ledger };
  emit();
  if (ledger) await SecureStore.setItemAsync(ACTIVE_KEY, JSON.stringify(ledger));
  else await SecureStore.deleteItemAsync(ACTIVE_KEY);
}

/** Clears the choice on logout so the next user doesn't inherit it. */
export async function clearActiveLedger(): Promise<void> {
  await setActiveLedger(null);
}

// Set when the active book is dropped mid-session because the server refused it.
// The local database still holds that book's rows and a watermark that belongs
// to it, so the next sync has to wipe before it pulls. It lives here rather than
// in sync.ts because api.ts is what discovers the refusal, and api.ts cannot
// import the sync engine without a cycle.
let stale = false;

/** Marks the local database as belonging to a book we can no longer read. */
export function markLedgerStale(): void {
  stale = true;
}

/** Reports and clears the stale flag. Called by the sync engine before pulling. */
export function takeLedgerStale(): boolean {
  const was = stale;
  stale = false;
  return was;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLedgerState(): LedgerState {
  return useSyncExternalStore(subscribe, getLedgerState, getLedgerState);
}
