# Build the SPA, then hand the static output to Caddy.
#
# Build context is the repo root, not web/, the client imports
# shared-context/domain straight from source (it is plain TypeScript with
# nothing to compile separately), so the build needs both directories.

FROM node:22-alpine AS build
WORKDIR /repo

# Dependencies first so a source-only change doesn't reinstall the world.
COPY web/package.json web/yarn.lock ./web/
RUN cd web && yarn install --frozen-lockfile

COPY shared-context ./shared-context
COPY web ./web

RUN cd web && yarn build

FROM caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/web/dist /srv
