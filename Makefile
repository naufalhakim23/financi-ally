# FinanciAlly monorepo. The OpenAPI contract in shared-context/contracts/ is the
# single source of truth for the API surface; `make generate-contract` regenerates
# the typed bindings for the Go backend (oapi-codegen) and both TS clients
# (openapi-typescript).
#
# The money logic itself lives in shared-context/domain/ and is imported by both
# clients, so `make test-domain` is the suite that guards the arithmetic.

CONTRACT := shared-context/contracts/openapi.yaml

.PHONY: help generate-contract gen-backend gen-mobile gen-web test-domain analyze

help:
	@echo "FinanciAlly monorepo targets:"
	@echo "  make generate-contract  regen BE (Go) + mobile + web bindings from $(CONTRACT)"
	@echo "  make gen-backend        regen backend/api/generated.go only"
	@echo "  make gen-mobile         regen mobile/src/lib/api-types.ts only"
	@echo "  make gen-web            regen web/src/lib/api-types.ts only"
	@echo "  make test-domain        run the shared money-logic suite (Vitest)"
	@echo "  make analyze            entry-pattern report against DATABASE_URL"
	@echo ""
	@echo "Edit $(CONTRACT), then run make generate-contract."

# Regenerate every client from the single contract. gen-web is skipped until
# web/ exists so this target stays usable during the web build-out.
generate-contract: gen-backend gen-mobile gen-web
	@echo ">> contract regenerated from $(CONTRACT)"

gen-backend:
	@cd backend && make gen

gen-mobile:
	@cd mobile && yarn gen

gen-web:
	@if [ -d web ]; then cd web && yarn gen; else echo ">> web/ not present yet, skipping"; fi

test-domain:
	@cd shared-context/domain && yarn test

# Empty until the app has been lived in for a few weeks; that is the point.
DATABASE_URL ?= postgres://financially:financially@localhost:5433/financially?sslmode=disable

analyze:
	@psql "$(DATABASE_URL)" -f backend/scripts/entry_patterns.sql
