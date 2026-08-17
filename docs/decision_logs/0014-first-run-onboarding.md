# 0014 — First-run onboarding: shared starter chart, derived setup state

Date: 2026-08-03
Status: accepted
Scope: `shared-context/domain`, `web`, `mobile`. No backend or schema change.
Plan: `docs/plans/04-financi-ally-onboarding-ia/plan.html`

## Context

A new user got an empty ledger and no instructions. The backend writes a user
row and lazily creates an empty personal ledger; it never seeds an account. The
double-entry core needs two accounts before anything can post, so day-one users
were locked out of the product's only real verb.

Web was worse than mobile: the dashboard's empty-state CTA opened an add-entry
form whose two selects both read "No accounts yet", whose Save could never
enable, and which offered no route to account creation. Mobile had a working
first-run path, but the starter categories were gated on a `?first=1` query
param rather than on the ledger being empty, so two of the three routes to a
first pocket produced a ledger with no categories at all.

## Decisions

### Starter chart lives in `@financially/domain`, each client writes it

`starter.ts` holds the catalog and the default selection. Nothing else.

Rejected: seeding server-side at `createPersonal`, or a `POST /onboarding/seed`.
Guest mode never contacts the server, so a backend seed would still need a
TypeScript copy of the list for mobile — which is exactly the client divergence
being fixed. One catalog, zero Go changes, zero contract churn.

The write differs per client because the persistence genuinely differs: web
POSTs `/accounts` sequentially, mobile writes WatermelonDB in one transaction so
guest mode keeps working with no server at all.

### Setup completion is derived, never stored

Every checklist tick is read from accounts and entries the clients already
query. Rejected: a `users.onboarded_at` column (needs a migration, means nothing
for a guest, and can desync from reality) and a local-only flag (wrong after a
reinstall or on a second device).

The one stored bit is the manual dismissal, which is a preference the data
cannot express.

"Record your first entry" excludes opening balances: `pocket-new` posts a real
equity-balanced manual entry for one, and counting it would tick the item for
someone who has recorded nothing.

### Skippable wizard plus persistent checklist, not one or the other

Blocking until a pocket and a category exist would guarantee nobody hits the
dead end, but traps someone who only wanted to look around. The checklist is
what catches whoever bails — it is the reason skipping is safe.

Web needs a session-scoped skipped flag: the layout guard sends an empty ledger
to `/app/setup`, so without it Skip lands on the dashboard and bounces straight
back. Session scope because it is "I already answered that", not a lasting
preference. Mobile needs no flag — its Home empty state offers the wizard rather
than redirecting into it.

### Both seeds are idempotent

The wizard stays reachable after setup (on mobile it is the only way to create a
category or an income source), so re-running it must be a no-op. Mobile filters
the selection against existing `(type, name)` pairs before writing; web treats a
409 from `POST /accounts` as "already there" and keeps going. Accounts are
unique on `(ledger_id, type, name)` server-side, so without this a second run
would surface as a sync rejection long after the user moved on.

### Divergences from the plan

- **No currency step.** `base_currency` is fixed at registration and has no
  update endpoint, so the planned step 1 could only ever display a value it
  could not change. Three steps: pockets, categories, income.
- **No "+ Add your own" field in the wizard.** The catalog covers first run;
  custom accounts belong on the screens that already own them.
- **`NewAccountDialog` extracted** out of `pockets.tsx` into its own component so
  the checklist can open it with the missing kind preselected — the whole point
  of a checklist is that its actions land on the exact thing that is missing.
- **Dashboard net worth left as `Rp 0`** for an un-set-up ledger. Zero is the
  true net worth of an empty ledger, and the checklist now sits directly above
  it saying what is missing.
- **Catch-all redirect in `App.tsx` left alone.** With `login` now reading
  `state.from`, an unknown path resolves `/nonsense → /app → /login → /app`. No
  loop, nothing to fix.

## Consequences

- Mobile still has no screen for creating a custom category or income source;
  the wizard's catalog is the only source. That was already true (the old seed
  offered four fixed categories), but it is now the documented path rather than
  an accident.
- Two wizard implementations share a catalog but not a rendering. Copy that
  matters lives beside the catalog in `starter.ts` so the two cannot drift.
