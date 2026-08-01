package handler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/getkin/kin-openapi/openapi3filter"
	oapimw "github.com/oapi-codegen/nethttp-middleware"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/household"
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
				// An invalid token on a public route is ignored; on a protected
				// route SpecValidator's auth check finds no principal → 401.
			}
			next.ServeHTTP(w, r)
		})
	}
}

// LedgerHeader names the request header that selects the active book. Absent
// means "my personal ledger", so pre-M8 clients keep working untouched.
const LedgerHeader = "X-Ledger-Id"

// LedgerScope resolves the active ledger for an authenticated request and folds
// it into the principal. It runs after AuthInject and before SpecValidator, so
// a rejection here happens before any handler sees the request.
//
// A membership miss is 403, not 404: the caller is authenticated, they just
// don't belong to the book they named. The repo cannot tell "no such ledger"
// from "not yours" by design, so both land here as the same answer.
func LedgerScope(hs *household.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := PrincipalFrom(r.Context())
			if !ok {
				// Public route, or an invalid token that SpecValidator will
				// reject in a moment. Either way there is no scope to resolve.
				next.ServeHTTP(w, r)
				return
			}
			scope, err := hs.Resolve(r.Context(), p.UserID, strings.TrimSpace(r.Header.Get(LedgerHeader)))
			if err != nil {
				if errors.Is(err, household.ErrLedgerNotFound) {
					writeJSONError(w, http.StatusForbidden, "ledger_forbidden",
						"you are not a member of this ledger")
					return
				}
				slog.Error("resolve ledger scope", "err", err, "user", p.UserID)
				writeJSONError(w, http.StatusInternalServerError, "internal_error", "internal server error")
				return
			}
			scoped := *p
			scoped.LedgerID = scope.LedgerID
			scoped.LedgerCurrency = scope.BaseCurrency
			scoped.LedgerRole = scope.Role
			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxkey.Auth, &scoped)))
		})
	}
}

// SpecValidator validates every request against the embedded OpenAPI spec
// (body, query, path params) and enforces bearer security on any operation
// marked `security: bearerAuth`; everything else (healthz, register, login) is
// public. Spec-derived security replaces the M1 path allowlist once the
// protected surface grew past a handful: ledger alone adds six book-scoped
// endpoints, and hand-maintaining a map would drift from the spec.
func SpecValidator() (func(http.Handler) http.Handler, error) {
	swagger, err := api.GetSwagger()
	if err != nil {
		return nil, fmt.Errorf("load embedded swagger: %w", err)
	}
	// Drop the server URL so routing matches request paths directly; the
	// servers entry is for clients, not in-process route resolution.
	swagger.Servers = nil
	return oapimw.OapiRequestValidatorWithOptions(swagger, &oapimw.Options{
		Options: openapi3filter.Options{
			AuthenticationFunc: requireBearer,
		},
		ErrorHandler: validationErrorHandler,
	}), nil
}

// requireBearer is the spec-derived security check. On a bearerAuth operation
// the principal must already be in context (set by AuthInject); otherwise this
// returns an error the validator maps to 401 (SecurityRequirementsError).
func requireBearer(ctx context.Context, ai *openapi3filter.AuthenticationInput) error {
	if ai.SecuritySchemeName != "bearerAuth" {
		return fmt.Errorf("unknown security scheme %q", ai.SecuritySchemeName)
	}
	if _, ok := PrincipalFrom(ctx); ok {
		return nil
	}
	return errors.New("missing or invalid token")
}

// PrincipalFrom extracts the authenticated principal, if present. Protected
// handlers can treat its absence as 401, but SpecValidator already guarantees
// presence on protected paths; the check is defense in depth.
func PrincipalFrom(ctx context.Context) (*auth.Principal, bool) {
	p, ok := ctx.Value(ctxkey.Auth).(*auth.Principal)
	return p, ok && p != nil
}

// bearerToken pulls the token from an `Authorization: Bearer <token>` header,
// case-insensitive on the scheme prefix. Empty string means absent/malformed.
func bearerToken(r *http.Request) string {
	const prefix = "Bearer "
	h := r.Header.Get("Authorization")
	if len(h) < len(prefix) || !strings.EqualFold(h[:len(prefix)], prefix) {
		return ""
	}
	return strings.TrimSpace(h[len(prefix):])
}

// validationErrorHandler renders spec-validation failures in our JSON Error
// shape: 401 for a missing/invalid bearer, 400 for malformed bodies/params,
// 405 for an unsupported method on a known path. The validator's verbose
// message is discarded to avoid leaking internal parse detail.
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
	writeJSONError(w, code, errCode, msg)
}

// writeJSONError renders the Error shape from middleware, where the generated
// strict-response types aren't available. Callers pass literals only, so no
// request data is interpolated and there is nothing to escape.
func writeJSONError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(`{"code":"` + code + `","message":"` + message + `"}`))
}
