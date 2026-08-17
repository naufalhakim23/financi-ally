// The catalog machinery: how a raw string tree becomes the tree a screen reads.
//
// Wording mode is a dimension of the catalog, not a seven-term patch bolted to
// the side of it. A leaf is either mode-independent (a plain string, or a
// function that interpolates one) or a `{ normal, finance }` pair. Resolving
// walks the tree once per mode and replaces every pair with its side, so screens
// index a plain object and never carry the mode around.

import type { Wording } from "../wording";

type Leaf = string | ((...args: never[]) => string);

type ModeKey = "normal" | "finance";

/** A leaf that says the same thing two ways. Both sides are the same shape. */
export type ModePair<T extends Leaf = Leaf> = { normal: T; finance: T };

export type Node = Leaf | ModePair | { [key: string]: Node };

/**
 * Exactly the two mode keys and nothing else, matching what `isModePair` checks
 * at runtime.
 *
 * A plain `T extends ModePair` is structural, so it also swallows any group that
 * merely happens to contain `normal` and `finance` among its keys — which
 * `settings.wording` does. That mismatch typed a ten-key group as `string` while
 * resolving to the whole object, and the two only disagreed at the call site.
 */
type IsModePair<T> = [keyof T] extends [ModeKey]
  ? [ModeKey] extends [keyof T]
    ? true
    : false
  : false;

/** The catalog as a screen sees it: every mode pair collapsed to one side. */
export type Resolved<T> = T extends Leaf
  ? T
  : IsModePair<T> extends true
    ? T extends ModePair<infer L>
      ? L
      : never
    : { [K in keyof T]: Resolved<T[K]> };

// A group whose only two keys are the mode names would be indistinguishable
// from a pair. No surface needs one, and the shape is loud enough that the
// collision would be obvious the moment it happened.
function isModePair(v: unknown): v is ModePair {
  if (typeof v !== "object" || v === null) return false;
  const keys = Object.keys(v);
  return keys.length === 2 && "normal" in v && "finance" in v;
}

function walk(node: unknown, mode: Wording): unknown {
  if (isModePair(node)) return node[mode];
  if (typeof node !== "object" || node === null) return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) out[key] = walk(value, mode);
  return Object.freeze(out);
}

export function resolve<T>(catalog: T, mode: Wording): Resolved<T> {
  return walk(catalog, mode) as Resolved<T>;
}
