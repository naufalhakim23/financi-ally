// The string catalog: the only place a user-facing string is written.
//
// A screen reads `strings(mode)` and indexes it. It never holds a literal, and
// it never carries the wording mode into a lookup — the tree it gets back is
// already resolved for the active mode.
//
// Two things deliberately stay outside:
//
//   - Domain modules that already own their copy (`starter`, `recurrence`,
//     `validate`, `buckets`, `ledger`). They are catalogs already, shaped by the
//     data rather than by the screen, and both clients read the same values.
//   - Defaults baked into `src/components/ui/` ("Choose", "Try again"). The kit
//     is a design system and stays ignorant of the domain; those are component
//     defaults a screen can always override with a catalog string.

import type { Wording } from "../wording";
import { resolve, type Resolved } from "./resolve";

import { auth } from "./auth";
import { books } from "./books";
import { buckets } from "./buckets";
import { budgets } from "./budgets";
import { common } from "./common";
import { entry } from "./entry";
import { history } from "./history";
import { home } from "./home";
import { moments } from "./moments";
import { month } from "./month";
import { more } from "./more";
import { recurring } from "./recurring";
import { reports } from "./reports";
import { settings } from "./settings";
import { setup } from "./setup";
import { sync } from "./sync";
import { terms } from "./terms";

export const catalog = {
  auth,
  books,
  buckets,
  budgets,
  common,
  entry,
  history,
  home,
  moments,
  month,
  more,
  recurring,
  reports,
  settings,
  setup,
  sync,
  terms,
};

/** The catalog as a screen sees it: mode already applied. */
export type Strings = Resolved<typeof catalog>;

// Both modes are resolved once at load. There are only two, the tree is small,
// and doing it here means `strings()` is a lookup rather than a walk on every
// render — no memo bookkeeping in the provider.
const BY_MODE: Record<Wording, Strings> = {
  normal: resolve(catalog, "normal"),
  finance: resolve(catalog, "finance"),
};

export function strings(mode: Wording): Strings {
  return BY_MODE[mode];
}

export { terms } from "./terms";
export type { ModePair, Resolved } from "./resolve";
