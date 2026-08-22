# Deploying FinanciAlly

One VPS running three containers: Postgres, the Go API, and Caddy serving the
SPA while proxying `/api` to the API. The same-origin shape is load-bearing, not
cosmetic: the browser's refresh token lives in a `SameSite=Lax` httpOnly cookie,
which only works because the SPA and the API share an origin. Split them and
CORS preflights and CSRF tokens both come back.

```
                 :443
  browser ──► Caddy ──┬── /api/*  ──strip prefix──► api:8080 ──► postgres:5432
                      └── /*      ──► SPA (static)
  phone ────────────► same :443 /api
```

## Prerequisites

- A box with Docker Engine and the compose plugin.
- A DNS A record pointing your hostname at it, **before first boot**: Caddy
  provisions TLS over the ACME HTTP challenge, which arrives on port 80.
- Ports 80 and 443 open. Nothing else needs to be: Postgres and the API publish
  no ports and are reachable only over the compose network.

## First deploy

```sh
git clone <repo> && cd financi-ally
cp .env.prod.example .env.prod
$EDITOR .env.prod          # SITE_ADDRESS, POSTGRES_PASSWORD, JWT_SECRET at minimum
docker compose -f docker/compose.prod.yml --env-file .env.prod up -d --build
```

Generate the secrets rather than inventing them:

```sh
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 32   # JWT_SECRET
```

The API applies migrations on boot and refuses to start if it cannot
(`cmd/server/main.go`), so a container that comes up is a container at schema
parity. Two other production guards fail the boot deliberately: a `JWT_SECRET`
still on the dev default, and no `RESEND_API_KEY` without `MAIL_MOCK=true`.

Check it:

```sh
curl https://<your-host>/api/healthz    # {"status":"ok","db":"up"}
```

## Creating accounts

Registration ships closed (`REGISTRATION_OPEN=false`), because an open
`/auth/register` on a public host accepts strangers. To create yours:

```sh
sed -i 's/REGISTRATION_OPEN=false/REGISTRATION_OPEN=true/' .env.prod
docker compose -f docker/compose.prod.yml --env-file .env.prod up -d api
# register from the app or the web client, then close it again
sed -i 's/REGISTRATION_OPEN=true/REGISTRATION_OPEN=false/' .env.prod
docker compose -f docker/compose.prod.yml --env-file .env.prod up -d api
```

Login and refresh are never gated, so closing it locks nobody out.

## Updating

```sh
git pull
docker compose -f docker/compose.prod.yml --env-file .env.prod up -d --build
```

Migrations run on boot. Rolling back code across a migration is not supported:
the down migrations exist but were written for development, not for a database
holding real entries.

## Backups

Nothing automated ships. Until it does, this is the whole job:

```sh
docker compose -f docker/compose.prod.yml --env-file .env.prod \
  exec -T postgres pg_dump -U financially financially | gzip > fa-$(date +%F).sql.gz
```

Put it in cron before the ledger holds anything you would miss.

## The Android build

`mobile/eas.json` carries `https://financially.invalid/api` as a placeholder in
both the preview and production profiles. **Replace `financially.invalid` with
your real hostname before building** — an APK built against the placeholder can
never reach a backend, and the URL is baked in at build time.

The `/api` suffix is required and easy to get wrong. Caddy strips the prefix
before proxying (`docker/Caddyfile`), so the Go server still sees `/auth/login`;
drop the suffix and every request lands on the SPA's index.html instead.

```sh
cd mobile
yarn build:preview        # eas build --profile preview → sideloadable APK
```

The development profile keeps `http://localhost:8080` with no `/api`: that build
talks to `make run` on the host, with no Caddy in front of it.

## Reading usage back

Once the app has been lived in for a few weeks, `make analyze` runs
`backend/scripts/entry_patterns.sql` and answers the questions the capture screen
was designed on intuition:

Locally, against the dev Postgres:

```sh
make analyze
```

On the production box, Postgres publishes no host port, so go through the
container rather than opening one:

```sh
docker compose -f docker/compose.prod.yml --env-file .env.prod \
  exec -T postgres psql -U financially financially < backend/scripts/entry_patterns.sql
```
