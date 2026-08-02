import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api, authedApi, HTTPError, setAccessToken, refreshAccessToken, type User } from "./api";
import { setActiveLedger } from "./ledger-store";

// Session state for the browser client.
//
// The access token never leaves memory (src/lib/api.ts owns it), so a reload
// starts with nothing. Boot therefore has to *earn* a session: call
// /auth/refresh, which succeeds only if the browser still holds the httpOnly
// fa_refresh cookie, then /auth/me for the user. Until that resolves the app
// shows nothing rather than flashing the login screen at an authenticated user.

type AuthState = {
  user: User | null;
  /** True until the boot refresh has settled. Routes must not decide before it. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, baseCurrency?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await refreshAccessToken();
        if (!token) return; // no cookie, or it expired — a signed-out visitor
        const me = await authedApi.me();
        if (alive) setUser(me);
      } catch {
        // A failed boot is simply "not signed in". Any real problem resurfaces
        // on the first action the user takes, with context to explain it.
        setAccessToken("");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const adopt = useCallback((res: { access_token: string; user: User }) => {
    // Start every sign-in on the personal book. `fa_active_ledger` outlives the
    // session (a closed tab never runs signOut), so without this a second user
    // on the same browser inherits the first one's book id and every authed
    // request comes back 403 not_a_member until they find the switcher.
    setActiveLedger(null);
    setAccessToken(res.access_token);
    setUser(res.user);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      adopt(await api.login(email, password));
    },
    [adopt],
  );

  const signUp = useCallback(
    async (email: string, password: string, baseCurrency?: string) => {
      adopt(await api.register(email, password, baseCurrency));
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    try {
      await authedApi.logout();
    } catch (e) {
      // A logout that the server never heard is still a logout here: the local
      // token is dropped either way, and the refresh cookie expires on its own.
      if (!(e instanceof HTTPError)) throw e;
    } finally {
      setAccessToken("");
      setActiveLedger(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
