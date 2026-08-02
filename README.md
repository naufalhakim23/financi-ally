# FinanciAlly

Personal expense & budget tracker. Double-entry ledger, multi-currency, offline-first mobile.
Go (chi + oapi-codegen) backend + Expo (Router + NativeWind + TanStack Query) mobile.

> Plan: `docs/plans/01-financi-ally/plan.html` (in the atlas workspace).
> Status: **M8: shared ledgers** — books, membership, join codes. Money is scoped
> to a *ledger* (a book of accounts), not a user: everyone has a personal book and
> can create or join household books. M9 adds Splitwise-style splitting on top.
> See milestones + decision logs (`docs/decision_logs/`).

## Repo map

```
financi-ally/
├─ docker/compose.yml     local Postgres (postgres:16-alpine)
├─ shared-context/        single OpenAPI contract + design tokens
│  └─ contracts/openapi.yaml   source of truth → BE + FE codegen
├─ backend/               Go service (chi + oapi-codegen + pgx)
│  ├─ cmd/server/         entrypoint
│  ├─ api/                oapi-codegen cfg + generated.go (regen from shared contract)
│  └─ internal/           config · db · handler · auth · household · ledger · budget · sync · pkg/{ctxkey,money}
└─ mobile/                Expo app (Router + NativeWind + WatermelonDB)
   ├─ app/                routes (auth screens + (app) tab group)
   └─ src/                lib (api-types.ts generated) · model (WatermelonDB) · components
```

## Prerequisites

- Go 1.26+
- Node 20+ (tested on 25) + npm
- Docker (for local Postgres)
- `oapi-codegen` + `air`: `cd backend && make install-tools`

## Quick start

```bash
# 1. Postgres
docker compose -f docker/compose.yml up -d

# 2. Backend
cd backend
cp .env.example .env
make install-tools   # one-time: oapi-codegen + air
make gen             # generate API from ../shared-context/contracts/openapi.yaml
make run             # http://localhost:8080/healthz

# 3. Mobile
cd ../mobile
npm install
npm run gen          # generate src/lib/api-types.ts from the shared contract
npx expo start       # needs a dev-client build (WatermelonDB is native, not in Expo Go)
```

> **WatermelonDB is native** — the app does **not** run in Expo Go. Build a dev
> client once: `npx expo prebuild` then `npx expo run:ios` / `run:android`
> (or EAS Build). After that, `npx expo start --dev-client` hot-reloads.
> Point the app at the backend via `EXPO_PUBLIC_API_URL` (defaults to
> `http://localhost:8080`).

`GET /healthz` → `{"status":"ok","db":"up"}` means the whole backend→DB chain is wired.

## Books (ledgers)

Every money endpoint reads and writes one *book*. Which one is chosen by the
`X-Ledger-Id` request header; omitting it means the caller's personal book, which
is created on first use. A book the caller is not a member of returns `403`.

| Endpoint | Purpose |
|---|---|
| `GET /ledgers` | books this user can open, personal first |
| `POST /ledgers` | create a shared household book (caller becomes owner) |
| `POST /ledgers/{id}/invite` | owner-only; issues a join code, revoking any previous one |
| `POST /ledgers/join` | redeem a code |
| `GET /ledgers/{id}/members` | who is in the book |
| `DELETE /ledgers/{id}/members/{userId}` | remove someone, or leave; the last owner cannot |

On mobile, switching books **wipes and re-pulls the local database** — the
WatermelonDB schema deliberately has no ledger column. The switch pushes pending
writes first and refuses to proceed if any are still unsynced.

## Builds (EAS)

`mobile/eas.json` defines three profiles. The first run needs an Expo account —
`eas init` writes the project id back into `app.json`.

```bash
cd mobile
npx eas-cli login
npx eas-cli init                       # one-time: links the Expo project
npx eas-cli build --profile development --platform ios      # dev client (WatermelonDB is native)
npx eas-cli build --profile preview --platform android      # installable APK for testers
npx eas-cli build --profile production --platform all
```

| Profile | Distribution | `EXPO_PUBLIC_API_URL` |
|---|---|---|
| `development` | dev client, internal, iOS simulator | `http://localhost:8080` |
| `preview` | internal, Android APK | `http://localhost:8080` |
| `production` | store | placeholder — **set this to the deployed API before shipping** |

The `production` URL in `eas.json` is a deliberate placeholder (`api.financially.invalid`)
so a store build can't silently point at nothing real.

## Tests

Backend integration tests hit a real Postgres; set `DATABASE_URL` or they skip.

```bash
cd backend
DATABASE_URL="postgres://financially:financially@localhost:5433/financially?sslmode=disable" make test
# Run serialized if packages share the DB (each truncates all tables):
DATABASE_URL=... go test -p 1 ./internal/...
```

## Make targets (backend)

| target | does |
|---|---|
| `make gen` | regenerate `api/generated.go` from the shared contract |
| `make build` | build server binary |
| `make run` | build + run |
| `make dev` | hot-reload via `air` |
| `make test` | `go test ./...` |
| `make install-tools` | install oapi-codegen + air |

## Contract / codegen

The single OpenAPI source of truth lives at `shared-context/contracts/openapi.yaml`.
From the repo root, one command regenerates both clients:

| target | does |
|---|---|
| `make generate-contract` | regen BOTH `backend/api/generated.go` + `mobile/src/lib/api-types.ts` |
| `make gen-backend` | regen backend only |
| `make gen-mobile` | regen mobile only |

Backend uses [oapi-codegen](https://github.com/oapi-codegen/oapi-codegen) (strict-server + chi);
mobile uses [openapi-typescript](https://github.com/openapi-ts/openapi-typescript) (types) +
[openapi-fetch](https://openapi-ts.github.io/openapi-fetch/) (typed client). Edit the contract
once, run `make generate-contract`, both sides update.

## Roadmap

- **M0** ✅ scaffold: monorepo, Go module, Expo app, OpenAPI skeleton, Postgres, oapi-codegen wired
- **M1** ✅ auth: email+pw JWT (argon2id, rotated refresh tokens), Google OAuth; Apple in M7
- **M2** ✅ ledger core: accounts (5 types), entries, lines, `Post()` balance invariant (in-tx + trigger)
- **M3** ✅ pockets UI + offline: WatermelonDB sync (pull/push), add-entry, dashboard, budgets
- **M4** ✅ multi-currency + FX job + reports (FX from frankfurter.app, server-normalized reports, mobile Reports tab)
- **M5** ✅ budgets: monthly category targets + budget screen (create/edit/delete UI + dashboard summary)
- **M6** ✅ recurring (RRULE): rules + server scheduler (idempotent per occurrence, catches up after downtime), offline sync, Recurring tab
- **M7** ✅ polish: DESIGN.md, charts (donut + monthly trend), onboarding + opening balance, empty/loading/sync states, EAS build config
  - still open: **Apple Sign-In** (needs an Apple Developer account) and running the first EAS build

> Synced tables use client-generated text IDs (WatermelonDB-native); `users`
> stays server-uuid. See `docs/decision_logs/0004-m3-sync.md`.
