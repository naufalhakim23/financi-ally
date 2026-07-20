# FinanciAlly

Personal expense & budget tracker. Double-entry ledger, multi-currency, offline-first mobile.
Go (chi + oapi-codegen) backend + Expo (Router + NativeWind + TanStack Query) mobile.

> Plan: `docs/plans/01-financi-ally/plan.html` (in the atlas workspace).
> Status: **M1: auth** (email+pw JWT + Google OAuth). See milestones in the plan.

## Repo map

```
financi-ally/
├─ docker/compose.yml   local Postgres (postgres:16-alpine)
├─ backend/             Go service (chi + oapi-codegen + pgx + goqu)
│  ├─ cmd/server/       entrypoint
│  ├─ api/              openapi.yaml + oapi-codegen cfg + generated.go
│  └─ internal/         config · db · handler · (ledger/budget/fx/... land later)
└─ mobile/              Expo app (Expo Router + NativeWind + TanStack Query)
   ├─ app/              file-based routes
   └─ src/              lib · (features/model/components land later)
```

## Prerequisites

- Go 1.26+
- Node 20+ (tested on 25) + npm
- Docker (for local Postgres)
- `oapi-codegen` + `air`: `cd backend && make install-tools`

## Quick start (M0)

```bash
# 1. Postgres
docker compose -f docker/compose.yml up -d

# 2. Backend
cd backend
cp .env.example .env
make install-tools   # one-time: oapi-codegen + air
make gen             # generate API from openapi.yaml
make run             # http://localhost:8080/healthz

# 3. Mobile
cd ../mobile
npm install
npx expo start       # press i / a / scan QR
```

`GET /healthz` → `{"status":"ok","db":"up"}` means the whole backend→DB chain is wired.

## Make targets (backend)

| target | does |
|---|---|
| `make gen` | regenerate `api/generated.go` from `openapi.yaml` |
| `make build` | build server binary |
| `make run` | build + run |
| `make dev` | hot-reload via `air` |
| `make test` | `go test ./...` |
| `make install-tools` | install oapi-codegen + air |

## Roadmap

- **M0** ✅ scaffold: monorepo, Go module, Expo app, OpenAPI skeleton, Postgres, oapi-codegen wired
- **M1** ✅ auth: email+pw JWT (argon2id, rotated refresh tokens), Google OAuth; Apple in M7
- **M2** ledger core: accounts (5 types), entries, lines, `Post()` balance invariant
- **M3** pockets UI + offline: WatermelonDB, sync pull/push, add-entry, dashboard
- **M4** multi-currency + FX job + reports
- **M5** budgets
- **M6** recurring (RRULE)
- **M7** polish: DESIGN.md, charts, onboarding, EAS build
