import * as SecureStore from "expo-secure-store";

// Tokens live in the device keystore/keychain (SecureStore), never in plain
// AsyncStorage. The access token is short-lived; the refresh token is single-
// use and rotated server-side on each /auth/refresh.
const ACCESS_KEY = "fa_access_token";
const REFRESH_KEY = "fa_refresh_token";

export async function getTokens(): Promise<{ access: string | null; refresh: string | null }> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return { access, refresh };
}

export async function setTokens(access: string, refresh: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, access),
    SecureStore.setItemAsync(REFRESH_KEY, refresh),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
