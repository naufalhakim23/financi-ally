import { useSyncExternalStore } from "react";
import * as SecureStore from "expo-secure-store";

// Guest mode: the app runs with no account at all. Every screen that reads or
// writes money is already local-first (WatermelonDB), so guest is not a second
// data path — it is the same path with the server half switched off.
//
// A module store rather than a context, because sync.ts has to read it with no
// React around: syncDatabase() must no-op for a guest, or every local write
// fires a 401 storm at endpoints there is no token for.
//
// Nothing here is a secret; SecureStore is used only because tokenStore and
// ledgerStore already do, and one storage mechanism is one thing to reason about.

const KEY = "fa_guest_currency"; // presence == guest mode; value == base currency

let currency: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** The guest's base currency, or null when not in guest mode. */
export function guestCurrency(): string | null {
  return currency;
}

export function isGuest(): boolean {
  return currency !== null;
}

/** Restores guest mode across a cold start. Call once at startup. */
export async function hydrateGuest(): Promise<void> {
  try {
    currency = await SecureStore.getItemAsync(KEY);
  } catch {
    // An unreadable value must not block startup, and guessing "guest" here
    // would hide a real session. Fall through to the token check.
    currency = null;
  }
  emit();
}

/** Enters guest mode with the chosen base currency. */
export async function startGuest(cur: string): Promise<void> {
  currency = cur;
  emit();
  await SecureStore.setItemAsync(KEY, cur);
}

/** Leaves guest mode. Local data is untouched — the caller decides its fate. */
export async function clearGuest(): Promise<void> {
  currency = null;
  emit();
  await SecureStore.deleteItemAsync(KEY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGuestCurrency(): string | null {
  return useSyncExternalStore(subscribe, guestCurrency, guestCurrency);
}
