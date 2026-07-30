# FinanciAlly

Personal expense & budget tracker. Double-entry ledger, multi-currency, offline-first mobile.
Go (chi + oapi-codegen) backend + Expo (Router + NativeWind + TanStack Query) mobile.

> Plan: `docs/plans/01-financi-ally/plan.html` (in the atlas workspace).
> Status: **M3: pockets UI + offline** — ledger core, budgets, WatermelonDB sync.
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
│  └─ internal/           config · db · handler · auth · ledger · budget · sync · pkg/{ctxkey,money}
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
- **M4** multi-currency + FX job + reports
- **M5** budgets — pulled forward into M3 (targets + spent rollup)
- **M6** recurring (RRULE)
- **M7** polish: DESIGN.md, charts, onboarding, EAS build

> Synced tables use client-generated text IDs (WatermelonDB-native); `users`
> stays server-uuid. See `docs/decision_logs/0004-m3-sync.md`.
