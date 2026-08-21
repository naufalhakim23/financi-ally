// Resolves the string catalog for one wording mode. A leaf is a string, a
// function, or a `{ normal, finance }` pair; pairs collapse to their side.

import type { Wording } from "../wording";

type Leaf = string | ((...args: never[]) => string);

type ModeKey = "normal" | "finance";

export type ModePair<T extends Leaf = Leaf> = { normal: T; finance: T };

export type Node = Leaf | ModePair | { [key: string]: Node };

// Exactly the two mode keys, matching isModePair. A structural `T extends
// ModePair` also swallows groups that merely contain both keys.
type IsModePair<T> = [keyof T] extends [ModeKey]
  ? [ModeKey] extends [keyof T]
    ? true
    : false
  : false;

export type Resolved<T> = T extends Leaf
  ? T
  : IsModePair<T> extends true
    ? T extends ModePair<infer L>
      ? L
      : never
    : { [K in keyof T]: Resolved<T[K]> };

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
