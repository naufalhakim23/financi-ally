// Client-side form rules for the auth screens.
//
// These mirror what the server enforces (auth.Service: one @ with something
// either side, 8-character minimum) and exist to fail fast in the field rather
// than after a round trip. The server stays authoritative — this is UX, not a
// trust boundary.

/** Minimum password length. Must not exceed the server's `minPasswordLen`. */
export const MIN_PASSWORD = 8;

/**
 * Deliberately loose: the only address that matters is one the user can receive
 * mail at, which no regex can prove. An exhaustive pattern rejects valid
 * addresses (plus-tags, new TLDs, unicode locals) and helps nobody.
 */
export function emailError(email: string): string | null {
  const v = email.trim();
  if (!v) return "Enter your email address";
  const at = v.indexOf("@");
  if (at <= 0 || at !== v.lastIndexOf("@") || at === v.length - 1) {
    return "That doesn't look like an email address";
  }
  return null;
}

export function passwordError(password: string): string | null {
  if (!password) return "Enter your password";
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters`;
  return null;
}

/** ISO 4217 is three letters. Blank is allowed where the field is optional. */
export function currencyError(code: string, { required }: { required: boolean }): string | null {
  const v = code.trim();
  if (!v) return required ? "Choose a currency" : null;
  return /^[A-Za-z]{3}$/.test(v) ? null : "Use a 3-letter code, like IDR or USD";
}

/** The emailed reset code: exactly six digits. */
export function resetCodeError(code: string): string | null {
  const v = code.trim();
  if (!v) return "Enter the code from your email";
  return /^\d{6}$/.test(v) ? null : "The code is 6 digits";
}
