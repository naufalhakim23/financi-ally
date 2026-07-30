// Bridge between the AuthProvider (which owns tokens) and the API client's
// authed fetcher. AuthProvider registers accessors on mount; reqAuthed reads
// them. This keeps the existing "api functions are pure" shape while avoiding
// threading the token+refresh through every call site.
export type AuthAccessors = {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
};

let accessors: AuthAccessors | null = null;

export function setAuthAccessors(a: AuthAccessors | null): void {
  accessors = a;
}

export function getAuthAccessors(): AuthAccessors | null {
  return accessors;
}
