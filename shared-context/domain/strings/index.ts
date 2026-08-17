// Every user-facing string. Screens read `strings(mode)` and index it.
// Outside on purpose: `starter`/`recurrence`/`validate`, which own their copy,
// and `src/components/ui/` defaults, since the kit stays domain-ignorant.

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

export type Strings = Resolved<typeof catalog>;

// Both modes resolved once at load, so `strings()` is a lookup, not a walk.
const BY_MODE: Record<Wording, Strings> = {
  normal: resolve(catalog, "normal"),
  finance: resolve(catalog, "finance"),
};

export function strings(mode: Wording): Strings {
  return BY_MODE[mode];
}

export { terms } from "./terms";
export type { ModePair, Resolved } from "./resolve";
