import { useCallback, useState } from "react";

import { useAuth } from "./auth";
import { syncDatabase } from "./sync";

/**
 * Pull-to-refresh for the screens that read local data.
 *
 * Those screens are already live — WatermelonDB observables repaint them the
 * moment a row changes — so "refresh" here means "go and see what the server
 * has", which is a sync cycle. The gesture is the universal mobile idiom for
 * exactly that question, and the app had no answer to it anywhere.
 *
 * Returns `null` for a guest: there is no server to reach, and a spinner that
 * resolves to nothing would suggest the app checked something it didn't.
 * Spread the result into a ScrollView's `refreshControl` only when non-null.
 */
export function useSyncRefresh(
  /**
   * Server reads the screen also shows (report endpoints, FX rates). Run
   * alongside the sync so one gesture refreshes everything on the screen, not
   * just the half that came from the local database.
   */
  also?: () => Promise<unknown>,
): { refreshing: boolean; onRefresh: () => void } | null {
  const { guest } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Failures already surface through the sync status strip in (app)/_layout;
    // rethrowing here would take down the screen that's reporting them.
    Promise.all([syncDatabase(), also?.()])
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [also]);

  if (guest) return null;
  return { refreshing, onRefresh };
}
