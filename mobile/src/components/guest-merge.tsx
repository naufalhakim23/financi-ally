import { useState } from "react";
import { router } from "expo-router";

import { Dialog } from "./ui";
import { useStrings } from "../lib/wording";
import { database } from "../lib/db";
import { markLedgerStale } from "../lib/ledgerStore";
import { syncDatabase } from "../lib/sync";

/**
 * The gate every screen that establishes a session must pass through.
 *
 * A guest has entries on this device that belong to nobody yet, and the first
 * sync after signing in pushes them into whatever account was just opened.
 * Login, Google sign-up and password reset all land in *existing* accounts, so
 * that push is a decision only the user can make.
 */
export function useGuestMerge(accountLabel?: string) {
  const s = useStrings();
  // >0 means we're holding on the merge question before leaving the screen.
  const [entries, setEntries] = useState(0);

  async function afterSignIn(wasGuest: boolean) {
    if (wasGuest) {
      const n = await database.get("entries").query().fetchCount();
      if (n > 0) {
        setEntries(n);
        return; // the dialog finishes the navigation
      }
    }
    await finish();
  }

  async function finish() {
    await syncDatabase().catch(() => {});
    router.replace("/(app)");
  }

  async function keepLocal() {
    setEntries(0);
    await finish();
  }

  // The stale flag is the existing "this local database belongs to a book we
  // can no longer read" mechanism: it wipes before the pull, which is exactly
  // what starting fresh means here.
  async function discardLocal() {
    markLedgerStale();
    setEntries(0);
    await finish();
  }

  const dialog = (
    <Dialog
      visible={entries > 0}
      title={s.auth.merge.title}
      body={s.auth.merge.body(entries, accountLabel || s.auth.merge.fallbackLabel)}
      cancelLabel={s.auth.merge.keep}
      confirmLabel={s.auth.merge.discard}
      onCancel={keepLocal}
      onConfirm={discardLocal}
    />
  );

  return { afterSignIn, dialog };
}
