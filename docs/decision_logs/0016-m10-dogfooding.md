# M10 — Dogfooding over features (2026-08-22)

**Status**: Decided, implemented, and run. The containerized stack was booted
and exercised locally; not yet deployed to a real host.

## The decision

M9 splitting was deferred. The next milestone is **getting the app onto a phone
and used daily**, plus the one capture change that makes daily use survivable.

### Why not M9

Two reasons, one product and one structural.

**Product**: asked what two people actually do with a shared book, the answer
was "both, at different times" — mostly pooled, with occasional
this-one-was-mine expenses. That makes splitting an *exception path*, not a mode
the ledger lives in. Decision log `0010` §9 specs the full Splitwise construct
(`entry_splits`, `paid_by_user_id`, member balances, settle-up transfers). That
is over-built for an exception. When M9 comes, it should likely be a toggle on
an entry, not a ledger-wide construct — a much smaller change than `0010`
anticipates.

**Structural**: nine milestones have shipped and none has been used by a human
for a week. This was demonstrated rather than asserted — a seven-section entry
pattern analysis was written to decide the capture design and returned zero
rows, because there is no data anywhere. No deployment, no CI, `eas.json`
pointing at `.invalid`.

Every finding in the 2026-08-21 design critique (safe-to-spend buried fourth at
22px, four chevrons to one destination, decorative controls, "Offline" rendered
three times) is the signature of software built carefully but never lived in.
More features do not fix that; usage does.

## What shipped

**Capture friction** — `Keypad` and `Save` moved out of the ScrollView in
`entry-new.tsx` into a pinned bottom dock. They used to sit at the bottom of the
same scroll as everything else, so the common path cost a scroll before the
first digit and a rejected save rendered its error off-screen (the critique's
"tap Save and nothing happens").

**Drafts were considered and rejected.** The original plan was capture-as-draft.
Three things killed it: the server hardcodes `'posted'` on insert
(`ledger/repo.go`), `pushEntry` never reads the field (`sync/service.go`), and
the shared domain `Entry` type has no `status` field at all — so a local draft
would silently move balances on Home, Buckets, History and Reports. It was also
unnecessary: edit-after-posting already shipped and solves the same problem.

**Deployment** — `backend/Dockerfile` (multi-stage, static, non-root; migrations
are `go:embed`ed so the runtime image carries no SQL), `docker/compose.prod.yml`
(Postgres + API + the existing Caddy web image, one VPS), `.env.prod.example`,
`docs/deploy.md`. Only Caddy publishes ports; Postgres and the API are reachable
only over the compose network.

**CI** — `.github/workflows/ci.yml`, the first CI in the repo. Four jobs:
backend (vet, build, `go test -p 1` **against a real `postgres:16` service**),
shared domain, mobile, web.

**Registration gate** — `REGISTRATION_OPEN` (default true) with
`handler.ClosedRegistration` in front of the generated router. A public host
otherwise accepts any stranger's sign-up. Chosen over an invite code in the
request body, which would have meant an OpenAPI change, a regen of three
clients, and a new field in the mobile signup form to gate a two-person ledger.

**Analysis instrument** — `backend/scripts/entry_patterns.sql` + `make analyze`.
Returns nothing today; answers the capture-design questions with evidence after
~3 weeks of real use.

## Five drifts found and fixed

1. **`accounts.owner_user_id` does not exist.** Decision log `0010` §7 said
   `accounts.user_id` "became `owner_user_id`, nullable and advisory", and its
   Open section said "M9 gives it a writer and a UI". Migration `009` actually
   **drops** the column outright ("no write path sets it"). `0010` is corrected;
   M9 settle-up must introduce an owner column from scratch.

2. **`eas.json` preview pointed at `http://localhost:8080`.** On a physical
   phone that is the phone's own localhost, so the sideloadable APK could never
   reach a backend. Preview and production now both carry one placeholder,
   `https://financially.invalid/api` — note the `/api` suffix, which Caddy
   strips and which is easy to get wrong. The development profile deliberately
   keeps bare `localhost:8080`: that build talks to `make run` with no Caddy in
   front of it.

3. **`yarn check` is a yarn v1 builtin.** It verifies the lockfile and never
   runs the `check` script — `mobile/package.json`'s real suite (tsc, token
   lint, eslint, rule tests) would have been silently skipped in CI. Every CI
   step uses `yarn run <script>`.

4. **`compose.prod.yml` and `compose.yml` shared a volume.** Both live in
   `docker/`, so both defaulted to project name `docker` and the same
   `docker_postgres_data`. The prod stack came up on the dev database, ignored
   `POSTGRES_PASSWORD` (Postgres only reads it when initializing an empty data
   directory) and failed auth. Fixed with an explicit `name: financially-prod`.
   Found by running it; no amount of reading would have shown this.

5. **Alpine ships no tzdata.** `RECURRING_TZ=Asia/Jakarta` reached the
   container, `time.LoadLocation` failed, and `getEnvLocation` fell back to UTC
   **without an error** (`config.go`) — so the scheduler would have resolved
   "the 1st of the month" seven hours off, silently. `tzdata` added to the
   runtime image. The silent fallback is arguably the real bug; left as-is
   because a mistyped zone still should not take the API down.

## Verified

- `go build ./...`, `go vet ./...` clean.
- `go test -p 1 ./...` against a real local Postgres — every integration suite
  actually ran rather than self-skipping. All green.
- `handler.ClosedRegistration` has a table test covering open, closed, a
  non-register route, and a non-POST method.
- `entry_patterns.sql` executed end-to-end against a scratch database at current
  schema, first empty and then seeded, and all seven sections returned correct
  numbers on the seeded set.
- `yarn run check` green in `mobile/` (with the dock change), `web/`, and
  `shared-context/domain/`; domain tests 60/60.

Then, against the containerized stack itself:

- `docker build` of `backend/Dockerfile`, and `compose.prod.yml` brought up.
  The API connected, applied migrations, and started under `ENVIRONMENT=production`.
- `GET /healthz` → `{"db":"up","status":"ok"}`.
- `POST /auth/register` → **403** with the gate closed, **200** with a real
  account and token pair after flipping `REGISTRATION_OPEN` and restarting.
  `POST /auth/login` reached its handler either way (401, no such user).
- `RECURRING_TZ` confirmed as `Asia/Jakarta` in the boot log after the tzdata fix.
- The prod-analysis command exactly as `docs/deploy.md` prints it, piped through
  `compose exec postgres psql`.

## Unverified

- Never deployed to a real host: no TLS provisioned, so the Caddy edge and the
  `web` service were not exercised (only `postgres` and `api` were brought up).
- CI has never run on a runner.
- The capture dock is typecheck-clean but has not been seen on a device.

## Known hazards carried forward

- Book-switch calls `unsafeResetDatabase()` and has never run on a device.
  Harmless with one book; test before creating a second.
- Local schema v3 upgrading in place is untested against real data.
- `eas.json` still holds `financially.invalid`. It must be replaced with the
  real hostname before `yarn build:preview`, or the APK is born unable to reach
  anything.
- No automated backups. `docs/deploy.md` gives the `pg_dump` one-liner; it is
  not in cron.
