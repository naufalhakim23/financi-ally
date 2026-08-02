import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { makeRedirectUri, useAuthRequest } from "expo-auth-session";

import { api, HTTPError, type AuthResponse, type User } from "./api";
import { setAuthAccessors } from "./authBridge";
import { clearActiveLedger, hydrateLedger } from "./ledgerStore";
import { clearTokens, getTokens, setTokens } from "./tokenStore";

// Google OIDC endpoints (stable). The client runs the authorization request
// on-device via expo-auth-session; the server redeems the code.
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type AuthContextValue = {
  user: User | null;
  loading: boolean; // true during initial token hydration
  googleEnabled: boolean;
  register: (email: string, password: string, baseCurrency?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleSignin: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Refs mirror tokens so logout/refresh callbacks read the latest without
  // stale-closure churn across renders.
  const accessRef = useRef<string | null>(null);
  const refreshRef = useRef<string | null>(null);

  const applySession = useCallback(async (s: AuthResponse) => {
    accessRef.current = s.access_token;
    refreshRef.current = s.refresh_token;
    setUser(s.user);
    await setTokens(s.access_token, s.refresh_token);
  }, []);

  const clearAll = useCallback(async () => {
    accessRef.current = null;
    refreshRef.current = null;
    setUser(null);
    // Drop the book choice too: the next person to sign in on this device is
    // almost certainly not a member of it, and every request would 403.
    await Promise.all([clearTokens(), clearActiveLedger()]);
  }, []);

  // Refresh-on-401: rotate tokens, update refs, return the new access token
  // (or null + session cleared if the refresh itself is dead).
  const refreshTokens = useCallback(
    async (refresh: string): Promise<string | null> => {
      try {
        const s = await api.refresh(refresh);
        accessRef.current = s.access_token;
        refreshRef.current = s.refresh_token;
        setUser(s.user);
        await setTokens(s.access_token, s.refresh_token);
        return s.access_token;
      } catch {
        await clearAll();
        return null;
      }
    },
    [clearAll],
  );

  // Register the token accessors with the auth bridge so the authed API fetcher
  // (api.ts reqAuthed) can read/refresh tokens without prop threading. Runs
  // after refreshTokens is defined; re-subscribes when it changes.
  useEffect(() => {
    setAuthAccessors({
      getAccessToken: () => accessRef.current,
      refreshAccessToken: async () => refreshTokens(refreshRef.current ?? ""),
    });
    return () => setAuthAccessors(null);
  }, [refreshTokens]);

  // Hydrate: if we have a stored access token, validate via /me; on 401 try a
  // single refresh before giving up and clearing the session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Restore the active book before any authed call, so the first request
      // after a cold start already carries the right X-Ledger-Id.
      await hydrateLedger();
      const { access, refresh } = await getTokens();
      if (access) {
        try {
          const u = await api.me(access);
          if (cancelled) return;
          accessRef.current = access;
          refreshRef.current = refresh;
          setUser(u);
        } catch (e) {
          if (cancelled) return;
          if (e instanceof HTTPError && e.status === 401) {
            // Access token definitively rejected by the server. Rotate via
            // refresh if we have one; otherwise the session is genuinely dead.
            if (refresh) await refreshTokens(refresh);
            else await clearAll();
          }
          // else: network blip / timeout / 5xx. Keep stored tokens intact so a
          // transient failure can't sign the user out — user stays null until a
          // later load re-validates successfully.
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTokens, clearAll]);

  const register = useCallback(
    async (email: string, password: string, baseCurrency?: string) => {
      const s = await api.register(email, password, baseCurrency);
      await applySession(s);
    },
    [applySession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const s = await api.login(email, password);
      await applySession(s);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    const access = accessRef.current;
    const refresh = refreshRef.current;
    if (access && refresh) {
      try {
        await api.logout(access, refresh);
      } catch {
        // Server may already be unreachable or the token dead; clear locally
        // regardless so the user is signed out of the app.
      }
    }
    await clearAll();
  }, [clearAll]);

  const redirectUri = makeRedirectUri({ path: "login" });
  const [, , promptAsync] = useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "email"],
      usePKCE: false, // server redeems with its own client_secret; no verifier to share
    },
    GOOGLE_DISCOVERY,
  );

  const googleSignin = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) throw new Error("Google sign-in is not configured");
    const res = await promptAsync();
    if (res?.type !== "success" || !res.params.code) {
      throw new Error("Google sign-in was cancelled");
    }
    const s = await api.google(res.params.code, redirectUri);
    await applySession(s);
  }, [promptAsync, redirectUri, applySession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        googleEnabled: !!GOOGLE_CLIENT_ID,
        register,
        login,
        googleSignin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
