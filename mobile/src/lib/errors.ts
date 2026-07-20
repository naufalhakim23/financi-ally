import { HTTPError } from "./api";

// Shared error→string mapping for the auth screens: prefer the server's
// message, fall back to the thrown Error, then a generic default the caller
// passes (so login vs register get their own headline).
export function messageFor(e: unknown, fallback: string): string {
  if (e instanceof HTTPError) return e.body?.message ?? fallback;
  if (e instanceof Error) return e.message;
  return fallback;
}
