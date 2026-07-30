# FinanciAlly monorepo. The OpenAPI contract in shared-context/contracts/ is the
# single source of truth for the API surface; `make generate-contract` regenerates
# the typed bindings for BOTH the Go backend (oapi-codegen) and the Expo mobile
# app (openapi-typescript) from it.

CONTRACT := shared-context/contracts/openapi.yaml

.PHONY: help generate-contract gen-backend gen-mobile

help:
	@echo "FinanciAlly monorepo targets:"
	@echo "  make generate-contract  regen BE (Go) + FE (TS) bindings from $(CONTRACT)"
	@echo "  make gen-backend        regen backend/api/generated.go only"
	@echo "  make gen-mobile         regen mobile/src/lib/api-types.ts only"
	@echo ""
	@echo "Edit $(CONTRACT), then run make generate-contract."

# Regenerate both clients from the single contract.
generate-contract: gen-backend gen-mobile
	@echo ">> contract regenerated for BE + FE from $(CONTRACT)"

gen-backend:
	@cd backend && make gen

gen-mobile:
	@cd mobile && yarn gen