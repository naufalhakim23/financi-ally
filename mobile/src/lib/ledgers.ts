import type { Ledger } from "./api";
import { database } from "./db";
import { activeLedgerId, setActiveLedger } from "./ledgerStore";
import { syncDatabase } from "./sync";
import { getSyncState, refreshPending } from "./syncState";

/**
 * Switches the app to another book.
 *
 * The local database is wiped and re-pulled rather than filtered, because the
 * WatermelonDB schema has no ledger column: two books' rows in one local store
 * would mean every screen carries a tenancy filter, and one missed filter shows
 * a household's spending inside a personal balance. Wiping is the smaller,
 * safer thing: the server is the source of truth and the pull is one request.
 *
 * Unsynced local writes are the hazard: they belong to the *current* book and a
 * reset destroys them. So the switch pushes first and refuses to continue if
 * anything is still pending. Losing an offline expense to a UI toggle is not an
 * acceptable trade.
 */
export async function switchLedger(next: Ledger | null): Promise<void> {
  const nextId = next?.id ?? "";
  if (nextId === activeLedgerId()) return;

  // Flush anything captured offline into the book it was written in.
  await syncDatabase();
  await refreshPending();
  if (getSyncState().pending) {
    throw new Error("Some changes haven't reached the server yet. Try again once syncing finishes.");
  }

  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  await setActiveLedger(next);
  await syncDatabase();
}
