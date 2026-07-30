import { useSyncExternalStore } from "react";
import { hasUnsyncedChanges } from "@nozbe/watermelondb/sync";

import { database } from "./db";

// Sync is money-visible: a write that hasn't reached the server, or one the
// server rejected on the balance invariant, must be shown — never swallowed.
// This is a module-level store rather than a context because sync.ts (plain
// module code, no React) is the writer.

export type SyncStatus = "idle" | "syncing" | "error";

export type SyncState = {
  status: SyncStatus;
  /** local writes not yet acknowledged by the server */
  pending: boolean;
  /** last cycle's failure — a dead network or a server error */
  lastError: string | null;
  /** records the server refused on push (e.g. an unbalanced entry) */
  rejected: number;
};

let state: SyncState = { status: "idle", pending: false, lastError: null, rejected: 0 };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setSyncState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  emit();
}

export function getSyncState(): SyncState {
  return state;
}

/** Re-reads WatermelonDB's unsynced flag into the store. */
export async function refreshPending(): Promise<void> {
  try {
    const pending = await hasUnsyncedChanges({ database });
    if (pending !== state.pending) setSyncState({ pending });
  } catch {
    // The flag is an indicator, not a source of truth — a failure to read it
    // must not break the screen that's showing it.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribe, getSyncState, getSyncState);
}
