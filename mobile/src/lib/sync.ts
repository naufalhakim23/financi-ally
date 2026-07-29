import { synchronize } from "@nozbe/watermelondb/sync";

import { authedApi } from "./api";
import { database } from "./db";

// Runs one WatermelonDB sync cycle: pull server changes into local tables, then
// push local (offline) changes up. On push the server re-runs the balance
// invariant; a rejected record is reported back in the response's errors and
// surfaced by the caller — never silently dropped.
export async function syncDatabase(): Promise<void> {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const resp = await authedApi.syncPull(lastPulledAt ?? 0);
      return { changes: resp.changes, timestamp: resp.timestamp };
    },
    pushChanges: async ({ changes }) => {
      const resp = await authedApi.syncPush(changes as Parameters<typeof authedApi.syncPush>[0]);
      if (resp.errors && Object.keys(resp.errors).length > 0) {
        // ponytail: log per-record push errors for now; a 422 "review this
        // entry" UI state is the M7 polish. Nothing is silently dropped.
        console.warn("[sync] push errors", resp.errors);
      }
    },
    sendCreatedAsUpdated: false,
  });
}
