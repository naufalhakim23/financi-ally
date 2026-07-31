// Keypad key handling, kept apart from the component so the digit arithmetic
// can be checked without a React Native runtime.

/** A keypad key: a digit, the fast "000" triple, or a backspace. */
export type KeypadKey = string | "000" | "back";

export const KEYPAD_KEYS: KeypadKey[] = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back",
];

/**
 * Apply a keypad press to the raw digit string the amount field holds.
 *
 * Leading zeros are stripped as soon as a real digit follows, and the string is
 * capped so `toMinor` never has to reject an overflow the user could not see
 * coming.
 */
export function applyKey(digits: string, key: KeypadKey): string {
  if (key === "back") return digits.slice(0, -1);
  const next = digits + key;
  return next.replace(/^0+(?=\d)/, "").slice(0, 15);
}
