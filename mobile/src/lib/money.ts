// Mobile mirror of the backend internal/pkg/money. The wire format is always
// integer minor units; this module owns amount<->minor conversion at the
// currency's scale so the UI never holds floats on a money path.

const SCALE0 = new Set([
  "IDR", "JPY", "KRW", "VND", "CLP", "ISK", "UGX", "PYG", "RWF", "VUV", "XAF", "XOF", "XPF",
]);
const SCALE3 = new Set(["KWD", "BHD", "OMR", "JOD", "TND", "IQD", "LYD"]);

export function scale(cur: string): number {
  if (SCALE0.has(cur)) return 0;
  if (SCALE3.has(cur)) return 3;
  return 2;
}

export function isAlpha3(s: string): boolean {
  return /^[A-Z]{3}$/.test(s);
}

// toMinor converts a decimal string ("50000", "50.00") to minor units at the
// currency's scale. Throws on malformed/negative/too-precise input.
export function toMinor(cur: string, amount: string): number {
  const sc = scale(cur);
  const raw = amount.trim();
  if (!raw || /[+-]/.test(raw)) throw new Error("invalid amount");
  const parts = raw.split(".");
  if (parts.length > 2) throw new Error("invalid amount");
  const ip = parts[0] ?? "";
  const fp = parts[1] ?? "";
  if (ip === "" && fp === "") throw new Error("invalid amount");
  if (!/^\d*$/.test(ip) || !/^\d*$/.test(fp)) throw new Error("invalid amount");
  if (fp.length > sc) throw new Error("too many decimals");
  const intPart = ip === "" ? 0n : BigInt(ip);
  const frac = sc > 0 && fp !== "" ? BigInt((fp + "0".repeat(sc)).slice(0, sc)) : 0n;
  let total = intPart;
  for (let i = 0; i < sc; i++) total *= 10n;
  total += frac;
  if (total > 9223372036854775807n) throw new Error("amount too large");
  return Number(total);
}

// format converts minor units to a decimal string at the currency's scale.
export function format(cur: string, minor: number): string {
  const sc = scale(cur);
  const neg = minor < 0;
  let n = Math.abs(minor);
  let s = String(n);
  if (sc === 0) return neg ? "-" + s : s;
  while (s.length <= sc) s = "0" + s;
  const out = s.slice(0, s.length - sc) + "." + s.slice(s.length - sc);
  return neg ? "-" + out : out;
}
