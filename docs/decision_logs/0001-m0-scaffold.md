# 0001 — M0 scaffold

**Date:** 2026-07-20
**Milestone:** M0 (scaffold)
**Status:** decided, implemented

## Context

M0 scaffolds the monorepo so every later milestone has a runnable foundation.
Done-criteria (plan §9): `make gen` + `docker compose up` + `expo start` all run;
empty `/healthz` green. The plan (§2, §6, §7) fixed the stack — Go + chi +
oapi-codegen + pgx + goqu; Expo Router + NativeWind + TanStack Query +
WatermelonDB — but left several M0-scoped forks open. This entry locks them.

## Decisions

| # | Decision | Chosen | Rejected & why |
|---|---|---|---|
| 1 | Repo topology | Independent git repo nested in atlas (`repos/financi-ally/.git`), matching academic-ops-web + wanderly | Plain atlas subdir — diverges from sibling convention |
| 2 | Go module path | `github.com/naufalhakim23/financi-ally/backend` | Project-org namespace — assumes a `financi-ally` org that doesn't exist |
| 3 | App identity | Display **FinanciAlly**, slug `financially`, scheme `financially`, bundle `com.naufalhakim23.financially` | Hyphenated `financi-ally` — plan listed name as unconfirmed; no-hyphen is cleaner for bundle ids |
| 4 | Postgres image | Plain `postgres:16-alpine` | `pgvector/pgvector:pg16` — FinanciAlly has no embedding/RAG surface (unlike academic-ops-web); pulling pgvector would be cargo-cult |
| 5 | Postgres host port | **5433** (container `5432`→host `5433`) | 5432 — Boss's Homebrew Postgres (pid-level) already owns loopback 5432; Docker's `*:5432` bind loses to it on 127.0.0.1, so the backend connected to Boss's DB ("role financially does not exist"). Own port keeps the project self-contained |
| 6 | Migrations (M0) | `internal/db/migrations/` dir + `.gitkeep` only | golang-migrate runner now — M0 done-criteria doesn't include `make migrate`; wiring the runner with zero migrations is setup debt with no payoff. Runner lands with `001_*.sql` in M2 |
| 7 | oapi-codegen mode | `chi-server: true`, **non-strict** | strict-server now — more machinery than one `GET /healthz` needs; flip to strict in M1 when the first typed request/response endpoint (register/login) lands (one-line cfg change) |
| 8 | Backend Dockerfile | Deferred | Build now — M0 runs the backend via `make run`/`make dev` on host; no milestone needs a backend image yet. Compose brings up Postgres only |
| 9 | Mobile M0 scope | Bare boot skeleton: Expo SDK 57 + expo-router + NativeWind v4 + TanStack Query, one Home screen hitting `/healthz` | Full stack now (WatermelonDB schema, sync.ts, model/, atomic components) — plan puts WatermelonDB + sync in M3; wiring them in M0 is 2–3× the work for surfaces that have no data layer to sit on yet |
| 10 | Base currency default | IDR (deferred — no config field until M1) | USD — plan context + Boss's market is ID-first; configurable later |

## Tradeoffs surfaced

- **Non-strict oapi-codegen (D7)** trades a small M1 cfg change for a much smaller
  M0 generated surface. If M1 reveals a strict-specific gotcha, M0 didn't catch
  it — accepted, since M0 proves the *pipeline* (spec → generated.go → compiles
  → serves), and strict is additive.
- **Postgres on 5433 (D5)** means the documented DSN differs from the conventional
  5432. Documented in README + `.env.example` + config default so it's not a
  footgun.
- **Mobile SDK 57** (not 54 like wanderly) — `create-expo-app@latest` resolved to
  57 (React 19.2, RN 0.86). Plan didn't pin a SDK; latest is correct. NativeWind
  v4 + babel-preset-expo 57.0.3 verified compiling via `expo export`.

## Verification (all green, 2026-07-20)

- `make gen` → `api/generated.go` regenerates; `oapi-codegen v2.7.1`
- `go build ./...` + `go vet ./...` + `go test ./...` clean
- `docker compose -f docker/compose.yml up -d` → `financially_db` healthy
- `GET /healthz` → `200 {"db":"up","status":"ok"}`
- `npx expo export --platform web` → full bundle (2.3 MB JS + NativeWind CSS) compiled, 0 errors

## Follow-ups (not M0)

- M1: strict-server flip; JWT + Apple/Google OAuth; `JWT_SECRET` prod guard.
- M2: golang-migrate runner + `001_*.sql` (ledger core); goqu dialect helper.
- M3: WatermelonDB schema + sync pull/push; real dashboard.
