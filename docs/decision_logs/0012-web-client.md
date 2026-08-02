# 0012 — Web client: shared domain, entry mutations, cookie auth

**Date**: 2026-08-02
**Status**: accepted (W0–W3 of plan 03; W4–W6 outstanding)
**Plan**: `docs/plans/03-financi-ally-web/plan.html`

## Context

The backend has been contract-first since M0, and every domain already has plain
REST endpoints — `/sync` is an *additional* path for WatermelonDB's offline
protocol, not the only one. That makes a browser client mostly a rendering
problem rather than a service problem. This log records the decisions taken
while building it, and the three places where reality differed from the plan.

## Decisions

### 1. Shared money logic lives in `shared-context/domain/`

The seven pure libraries (`money`, `balances`, `buckets`, `ledger`, `fx`,
`validate`, and the vocabulary half of `wording`) moved out of
`mobile/src/lib/`. They are imported by both clients as `@financially/domain/*`.

- **Typing**: the domain declares its own plain records (`domain/types.ts`),
  camelCase with `Date | string` for dates. Deliberately *not* the generated
  contract types: the contract is snake_case with ISO strings, while
  WatermelonDB models are camelCase with real `Date`s. A mobile model satisfies
  the domain types structurally, so mobile changed zero call sites; web pays one
  small adapter (`web/src/lib/adapters.ts`).
- **Mobile stayed on shims**: `mobile/src/lib/money.ts` and friends are now
  one-line re-exports rather than deletions. ~30 import sites across `app/`
  never had to change, which keeps the extraction's diff — and its regression
  surface — as small as it can be.
- **`wording` split**: the term map is shared; the React provider and its
  persistence are per-client. A context cannot cross React Native and the DOM,
  and the storage differs anyway.
- **Payoff**: `shared-context/domain/domain.test.ts` (Vitest, 20 cases) is the
  first automated test this arithmetic has ever had, and it guards both clients.
  `make test-domain`.

**Rejected**: copying the logic into `web/`. Faster today, and guarantees the
two clients disagree about money later.

### 2. Metro needed two changes, and one of them is non-obvious

Sharing code outside the Expo project root is not just a `watchFolders` entry:

- `watchFolders` + a `resolveRequest` mapping for `@financially/domain/*`
  (`mobile/metro.config.js`). A bare relative path out of the project root does
  not resolve, and `extraNodeModules` keyed on `@domain` never matches
  `@domain/money` — Metro reads `@scope/name` as one package key.
- **`app.json` → `experiments.onDemandFilesystem: false`.** This is the one that
  costs an afternoon. Expo SDK 54's `expo export` truncates `watchFolders` down
  to `projectRoot` when the on-demand filesystem is on
  (`@expo/cli … withMetroMultiPlatform.js`), so the domain resolves and then
  fails with "Failed to get the SHA-1". The flag is read from `app.json` only —
  setting it in `metro.config.js` has no effect. Exports get slower; a build
  that cannot see the money logic is worse.

Verified with a full `expo export --platform android`, not just a typecheck.

### 3. Posted entries: soft-delete, memo-only edit

The plan described `DELETE`/`PATCH /entries/{id}` as "lifting what sync push
already does". It does not: sync push handled `Deleted` for
accounts/budgets/recurring only, and ignored `entries.Updated` entirely. These
are new semantics, so they were chosen rather than inherited:

- **DELETE is a soft-delete** (`entries.deleted_at`). Every read path — balance
  totals, all four reports, list, get, sync pull — already filtered
  `e.deleted_at IS NULL`, so one flag removes the entry from the ledger
  everywhere while the row survives for audit. Idempotent, so a sync replay is
  not an error.
- **PATCH edits the memo and nothing else.** Amounts, accounts and the date
  *are* the posting; correcting one means deleting and re-posting. The ledger
  service enforces this regardless of what any client's UI offers.

**Rejected**: full `PATCH` of a line's `account_id` (makes a posted entry
editable and destroys the audit property); reversing entries (correct
accounting, but two rows per mistake, and it leaves mobile's local delete
wrong).

**Bug fixed on the way**: `mobile/app/(app)/entry/[id].tsx` has always deleted
entries locally, and sync push silently dropped it — the entry, and its money,
came back on the next pull. Push now routes `entries.Deleted` through
`ledger.DeleteEntry` and `entries.Updated` through `UpdateEntryMemo`, and
`PullDeleted` reports deleted entries plus their lines (a line has no
`deleted_at` of its own, so it resolves through its entry). Guarded by
`TestPushDeletedEntryStaysDeleted`.

### 4. Refresh token in an httpOnly cookie, behind `WEB_COOKIE_AUTH`

The web access token lives in memory only, so a reload has nothing to
authenticate with. Parking the refresh token in `localStorage` instead would
make one XSS a permanent account takeover on a finance app. Because the SPA is
served same-origin with the API, an httpOnly cookie is nearly free: no CORS, no
`SameSite=None`, and — with `SameSite=Lax` + `Path=/api/auth` — no CSRF token,
since the cookie only ever rides refresh/logout while money mutations need the
`Authorization` header an attacker's page cannot read.

Implemented as **one strict middleware** (`internal/handler/cookie_auth.go`)
rather than per-handler code: the handlers own the single rotation path, and the
only browser-specific part is *where* the token is read from and whether a
`Set-Cookie` rides along. Two refresh implementations would mean one of them
silently stops rotating.

Two contract facts discovered by testing, not reading:

- oapi-codegen passes the **Go handler name** to a strict middleware
  (`"Refresh"`, not the contract's `refresh`).
- `requestBody: required: false` is not honoured — the generated handler always
  decodes a body and 400s on an empty one. So `refresh_token` itself became
  optional and a browser posts `{}`.

`ResetPassword` sets the cookie too; a reset returns a session, and the web
client re-enters through the normal boot path afterwards.

Off by default. Mobile's body-based flow is untouched, and `WEB_COOKIE_SECURE`
is forced on in production.

### 5. Web data layer: TanStack Query, no optimism on money

One cache, no persistence. Two rules encoded in `web/src/lib/queries.ts`:

- **Every money query key is namespaced by the active book** (`qk.book(...)`),
  and switching books clears the cache outright. Showing one book's balances
  under another book's name is the worst bug this app could ship.
- **A mutation invalidates the whole book**, not the exact keys it touched. One
  posted entry moves two balances, the month's spend, a budget's progress, net
  worth and three reports; enumerating that is a maintenance trap whose failure
  mode is a stale number on a finance screen.
- **No optimistic update for `POST /entries`.** An entry the server rejects as
  unbalanced would otherwise show a balance that never existed. Optimism is
  allowed only for delete/relabel.
- Reads always send `from`/`to`: `GET /entries` is unpaginated and there is no
  local store to soften a whole-book download. Dashboard uses a rolling 12
  months, history one month at a time.

### 6. UI: shadcn/ui rethemed to DESIGN.md

Boss's call over hand-rolling the atoms. `web/src/index.css` declares the
DESIGN.md roles as CSS variables under the same semantic names mobile uses, then
maps shadcn's alias set (`--color-card`, `--color-muted`, …) onto those roles, so
an imported component arrives already speaking Financi-Ally rather than carrying
a second palette.

`card-split-accordion` came from the Watermelon UI registry
(`registry.watermelon.sh`) and was retyped: its zinc palette and demo copy were
replaced with DESIGN.md roles, its `react-icons` dependency dropped (DESIGN.md
names Lucide as the icon library), and `content` takes a `ReactNode` so a bucket
can hold a list of accounts instead of a paragraph. It drives the bucket
drill-down on the dashboard.

## Verification

Empirically checked, not inferred:

- `expo export --platform android` bundles; `tsc` and `npm run check` clean.
- Backend suite green against Postgres, including new coverage for delete /
  memo-edit / account-patch and the sync delete round-trip.
- All three endpoints exercised live over HTTP: `PATCH /accounts/{id}` (rename,
  archive, empty-body 400), `PATCH /entries/{id}`, `DELETE /entries/{id}`
  (balance 50000 → 0, repeat 204, unknown 404).
- Cookie flow over HTTP: `Set-Cookie` on register, refresh from cookie with an
  empty body, rotation, replay of a spent token 401s, logout clears and revokes.
- Browser (Playwright, 1440 and 375): register → shell → **full document load
  keeps the session**, `document.cookie` empty (httpOnly holds), no token in
  `localStorage`; create accounts, post income and a spend, dashboard shows
  9,000,000 − 85,000 = 8,915,000, bucket drill-down, history by month, entry
  modal over the list, memo edit and delete both propagate. No horizontal scroll
  at 375px.
- `make generate-contract` is idempotent — no drift.

## Not done

W4 (budgets, reports, recurring, books admin), W5 (guest mode, landing page),
W6 (nginx/Caddy same-origin config). Those routes render a placeholder. M9
splitting is deliberately out of web v1 — Boss's call, since splitting lives in
a side table rather than changing the entry shape.

Mobile runtime was verified by bundling, not by running the app on a device;
Boss's smoke run is still the last word on the extraction.
