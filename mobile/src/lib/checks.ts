// Self-check for the mobile-only pure logic. The money math (fx, ledger,
// buckets, csv) moved to shared-context/domain and is covered by Vitest there —
// `yarn --cwd ../shared-context/domain test` — so both clients get one suite.
//
// What is left here is the keypad, which is a mobile input concern and has no
// web counterpart. Run it with `npm run check`.

function ok(condition: boolean, what: string): void {
  if (!condition) throw new Error(`check failed: ${what}`);
}

const assert = {
  ok,
  equal: (a: unknown, b: unknown, what: string) =>
    ok(a === b, `${what} (got ${String(a)}, wanted ${String(b)})`),
};

import { applyKey } from "./keypad";

assert.equal(applyKey("", "4"), "4", "first digit");
assert.equal(applyKey("0", "5"), "5", "a leading zero is replaced");
assert.equal(applyKey("45", "000"), "45000", "the triple appends three zeros");
assert.equal(applyKey("45", "back"), "4", "backspace");
assert.equal(applyKey("", "back"), "", "backspace on empty is a no-op");
assert.equal(applyKey("999999999999999", "9").length, 15, "capped before toMinor can overflow");

console.log("all checks passed");
