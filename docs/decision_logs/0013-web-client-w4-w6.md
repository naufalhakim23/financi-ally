# 0013, Web client W4 to W6: remaining screens, landing page, same-origin serving

Status: implemented
Date: 2026-08-03
Supersedes nothing. Continues [0012](0012-web-client.md), which shipped W0 to W3.

## Context

0012 left four routes rendering a placeholder (budgets, reports, recurring,
books) and three plan steps open: W4 (those screens), W5 (guest mode plus a
landing page), W6 (same-origin serving). Nine of the eleven screens in the plan
need no backend work, so this was render work against endpoints that already
existed.

## Decisions

### Guest mode on web is dropped

Plan 03 carried guest mode as a Boss override, with ATLAS on record that it is a
second data layer inside a client whose premise is "no local data". Revisited
before building it, Boss chose to drop it on web. Mobile keeps guest mode
unchanged: there it is genuinely cheap, because every screen is already
local-first and guest is the same path with the server half switched off. On web
it would have meant a localStorage ledger, a merge-on-signin replay, and a second
set of derivations to keep agreeing with the server's.

What this costs: a logged-out visitor cannot try the product without an account.
The landing page carries the pitch instead. Revisit if signup conversion turns
out to need it.

### Charts use recharts rather than hand-rolled SVG

Mobile's donut and trend bars are hand-rolled because react-native-svg is the
only option there. On web, recharts buys tooltips, responsive containers and
axis layout that would otherwise be written twice. Cost: about 110 kB gzipped,
and two chart implementations that must be kept visually agreeing across the two
clients. Mitigated by driving both from the same `--chart-1..8` ramp with fixed
slot assignment, and by keeping the legend as the value table on both, so
identity never rests on color.

The reports route is `lazy()`-loaded for this reason. It is the only screen that
pulls the library in and the least-opened screen in the app, so splitting it took
the initial bundle from 318 kB to 207 kB gzipped.

### RRULE handling moved into the shared domain

`buildRRule` / `parseRRule` / `describeRRule` lived inside mobile's recurring
screen. Web needed the same three functions, and a rule authored on one client
has to read back identically on the other, so they moved to
`shared-context/domain/recurrence.ts` with mobile repointed through a re-export
shim (the same pattern W0 used for the money modules). They now have test
coverage they never had, including the ordinal case that gets "11st" wrong.

### Caddy for same-origin serving

`docker/Caddyfile` plus `web/Dockerfile` (build stage from the repo root, since
the client imports `shared-context/domain` from source). Chosen over nginx for
automatic HTTPS and built-in SPA fallback in about ten lines. The web service
sits behind a compose profile because day-to-day work runs `yarn dev`, whose
proxy mirrors this exactly, and only needs Postgres up.

`handle_path /api/*` strips the prefix because the Go server routes at the root.
The cookie path stays `/api/auth` because that is what the *browser* sees, which
is precisely the mismatch `WEB_COOKIE_PATH` exists for.

## Bugs found and fixed during verification

Two were real defects in already-shipped W0 to W3 code, found only because these
screens exercised paths nothing had exercised before:

- **The active book was not reactive.** `activeLedgerId()` is a module getter
  with a listener API, but every consumer called it during render. Switching
  books changed the `X-Ledger-Id` header on the next request while the screen
  kept painting the previous book's name and an "Active" tick on the wrong row.
  Worse, the query hooks compute their cache keys from it, so a response for the
  new book could land under the old book's key. Fixed at the source with
  `useActiveLedger()` (`useSyncExternalStore`), used by every render-time read;
  the mutation callbacks still use the plain getter because they run outside
  render.
- **An ungrouped figure on the budgets row.** `format()` returns a bare decimal;
  grouping lives in `formatAmount`. The row read "of 200000".

## Verification

Empirically checked in a browser at 1440 and 375, against a scratch database
(Boss's local Postgres is at migration 12 from a `feat(scan)` branch, while
`main` has 10, so it was left untouched):

- Budgets: set a target, spent-vs-target renders, delete confirms.
- Reports: net worth 1,765,000,000 IDR matches the seeded ledger by hand; donut
  shares (65 / 35) and the 12-month trend render; range picker refetches.
- Recurring: rule saved, read back as "Monthly on the 3rd, from Bank" through
  the shared parser; "Run due now" returns "Nothing due right now" (correct, the
  rule is not due until Aug 3 UTC).
- Books: create, switch, invite code with expiry, members list, leave. After
  switching into an empty shared book every figure reads zero, and switching
  back restores the personal book's figures. No cross-book leak.
- No horizontal page scroll at 375 px; `scrollWidth === clientWidth`.
- `tsc -b --force` clean on web, `tsc --noEmit` clean on mobile, 25 domain tests
  green, production build succeeds.

`recharts` needed `react-is` added explicitly; yarn does not hoist it and the
production build fails to resolve it otherwise.

## Not done

- M9 splitting UI, still deliberately out of web v1 (plan 02 owns it).
- `GET /entries` remains unpaginated. Every web caller passes a bounded range,
  so this is contained, not solved.
- The web container is not wired to a backend service, because the backend is
  still run on the host via `make run`. `API_UPSTREAM` defaults to
  `host.docker.internal:8080` and should point at `backend:8080` once that
  service exists.
- Design-token drift between Tailwind and NativeWind is still tracked as an open
  gap, not resolved.
