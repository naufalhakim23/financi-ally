package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/getkin/kin-openapi/openapi3filter"
	oapimw "github.com/oapi-codegen/nethttp-middleware"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/ctxkey"
)

// AuthInject verifies a Bearer token when one is present and stashes the
// principal in the request context. It enforces nothing by itself: public
// routes pass with or without a token, and protected routes are enforced by
// SpecValidator below (spec-derived). The verify happens here — not inside the
// validator's AuthenticationFunc — because the validator does not propagate
// request-context mutations to the downstream handler, so the principal must be
// set on the real request before validation runs. One verify per request.
func AuthInject(verifier *auth.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if raw := bearerToken(r); raw != "" {
				if claims, err := verifier.Verify(raw); err == nil {
					p := &auth.Principal{UserID: claims.UserID, Email: claims.Email}
					r = r.WithContext(context.WithValue(r.Context(), ctxkey.Auth, p))
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// SpecValidator validates every request against the embedded OpenAPI spec
// (body, query, path params) and enforces bearer security on any operation
// marked `security: bearerAuth`; everything else (healthz, register, login) is
// public. Spec-derived security replaces the M1 path allowlist once the
// protected surface grew past a handful — ledger alone adds six user-scoped
// endpoints, and hand-maintaining a map would drift from the spec.
func SpecValidator() (func(http.Handler) http.Handler, error) {
	swagger, err := api.GetSwagger()
	if err != nil {
		return nil, fmt.Errorf("load embedded swagger: %w", err)
	}
	swagger.Servers = nil
	return oapimw.OapiRequestValidatorWithOptions(swagger, &oapimw.Options{
		Options: openapi3filter.Options{
			AuthenticationFunc: requireBearer,
		},
		ErrorHandler: validationErrorHandler,
	}), nil
}

// requireBearer is the spec-derived security check.
func requireBearer(ctx context.Context, ai *openapi3filter.AuthenticationInput) error {
	if ai.SecuritySchemeName != "bearerAuth" {
		return fmt.Errorf("unknown security scheme %q", ai.SecuritySchemeName)
	}
	if _, ok := PrincipalFrom(ctx); ok {
		return nil
	}
	return errors.New("missing or invalid token")
}

// PrincipalFrom extracts the authenticated principal, if present.
func PrincipalFrom(ctx context.Context) (*auth.Principal, bool) {
	p, ok := ctx.Value(ctxkey.Auth).(*auth.Principal)
	return p, ok && p != nil
}

func bearerToken(r *http.Request) string {
	const prefix = "Bearer "
	h := r.Header.Get("Authorization")
	if len(h) < len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return ""
	}
	return strings.TrimSpace(h[len(prefix):])
}

func validationErrorHandler(w http.ResponseWriter, _ string, code int) {
	errCode, msg := "bad_request", "malformed request"
	switch code {
	case http.StatusUnauthorized:
		errCode, msg = "unauthenticated", "missing or invalid token"
	case http.StatusMethodNotAllowed:
		errCode, msg = "method_not_allowed", "method not allowed"
	case http.StatusNotFound:
		errCode, msg = "not_found", "resource not found"
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write([]byte(`{"code":"` + errCode + `","message":"` + msg + `"}`))
}
