package handler

import (
	"context"
	"net/http"
	"strings"

	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/ctxkey"
)

// protected is the allowlist of operations that require a valid bearer token.
// Everything else (healthz, register, login, refresh, google) is public.
//
// ponytail: path allowlist over a kin-openapi spec-driven request validator.
// Two protected ops don't justify the validator dependency yet. Upgrade to
// spec-derived security (middleware.OapiRequestValidatorWithOptions) once the
// protected surface grows past a handful and hand-maintenance becomes a footgun.
var protected = map[string]map[string]bool{
	http.MethodGet:  {"/auth/me": true},
	http.MethodPost: {"/auth/logout": true},
}

// AuthMiddleware verifies a Bearer JWT on protected operations and stashes the
// principal in the request context. Public operations pass through untouched.
// On any failure (missing/malformed header, bad signature, expired) it writes a
// 401 and short-circuits; never calls next.
func AuthMiddleware(verifier *auth.JWTService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !protected[r.Method][r.URL.Path] {
				next.ServeHTTP(w, r)
				return
			}
			raw := bearerToken(r)
			if raw == "" {
				writeUnauth(w)
				return
			}
			claims, err := verifier.Verify(raw)
			if err != nil {
				writeUnauth(w)
				return
			}
			ctx := context.WithValue(r.Context(), ctxkey.Auth,
				&auth.Principal{UserID: claims.UserID, Email: claims.Email})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// PrincipalFrom extracts the authenticated principal, if present. Protected
// handlers can treat its absence as 401, but the middleware already guarantees
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

func writeUnauth(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	_, _ = w.Write([]byte(`{"code":"unauthenticated","message":"missing or invalid token"}`))
}
