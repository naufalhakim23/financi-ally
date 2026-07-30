# FinanciAlly backend. Mirrors the academic-ops-web Makefile shape.

.PHONY: help gen generate build run dev test fmt vet install-tools clean

GOBIN := $(shell go env GOPATH)/bin

help:
	@echo "FinanciAlly backend targets:"
	@echo "  make gen            regenerate api/generated.go from openapi.yaml"
	@echo "  make build          build ./bin/server"
	@echo "  make run            build + run"
	@echo "  make dev            hot-reload via air"
	@echo "  make test           go test ./..."
	@echo "  make fx-refresh     trigger FX rate refresh via the running server"
	@echo "  make install-tools  install oapi-codegen + air"
	@echo ""
	@echo "Go bin: $(GOBIN)"

# Generate API code from OpenAPI spec.
gen generate:
	@echo ">> generating API from openapi.yaml"
	@$(GOBIN)/oapi-codegen -config api/cfg.yaml api/openapi.yaml

# Build (does NOT regenerate. Run `make gen` after editing openapi.yaml).
build:
	@echo ">> building server"
	@go build -o bin/server ./cmd/server

run: build
	@./bin/server

dev:
	@$(GOBIN)/air

test:
	@go test ./...

fmt:
	@go fmt ./...

vet:
	@go vet ./...

fx-refresh:
	@curl -s -X POST http://localhost:8080/fx/rates/refresh \
		-H "Authorization: Bearer $$(echo 'needs valid token — run manually after login')" \
		-H "Content-Type: application/json" | jq .
	@echo "(replace the token above with a valid JWT from the running server)"

clean:
	@rm -rf bin tmp

install-tools:
	@go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
	@go install github.com/air-verse/air@latest
	@echo "tools installed in $(GOBIN)"
