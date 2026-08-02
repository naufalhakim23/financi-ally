import { synchronize } from "@nozbe/watermelondb/sync";
import type { SyncPullResult } from "@nozbe/watermelondb/sync";

import { authedApi } from "./api";
import { database } from "./db";
import { refreshPending, setSyncState } from "./syncState";

// Runs one WatermelonDB sync cycle: pull server changes into local tables, then
// push local (offline) changes up. On push the server re-runs the balance
// invariant; a rejected record is reported back in the response's errors and
// surfaced through syncState (header chip + banner) — never silently dropped,
// because a record dropped here is missing money.
export async function syncDatabase(): Promise<void> {
  setSyncState({ status: "syncing", lastError: null });
  try {
    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) => {
        const resp = await authedApi.syncPull(lastPulledAt ?? 0);
        // The generated OpenAPI type marks created/updated/deleted optional;
        // the server always sends all three. Cast rather than rebuild the shape.
        return { changes: resp.changes, timestamp: resp.timestamp } as SyncPullResult;
      },
      pushChanges: async ({ changes }) => {
        const resp = await authedApi.syncPush(changes as Parameters<typeof authedApi.syncPush>[0]);
        const rejected = resp.errors ? Object.keys(resp.errors).length : 0;
        setSyncState({ rejected });
        if (rejected > 0) console.warn("[sync] push errors", resp.errors);
      },
      sendCreatedAsUpdated: false,
    });
    setSyncState({ status: "idle" });
  } catch (e) {
    setSyncState({ status: "error", lastError: e instanceof Error ? e.message : "sync failed" });
    throw e;
  } finally {
    await refreshPending();
  }
}
