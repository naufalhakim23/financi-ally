package handler

import "net/http"

// ClosedRegistration blocks POST /auth/register when open is false. Sits in
// front of the generated router so the auth service, its tests and the OpenAPI
// contract stay untouched.
//
// ponytail: one on/off env var, no invite code. Enough for a household-sized
// ledger; move to a per-invite code in the body when sign-ups must happen
// without shell access.
func ClosedRegistration(open bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if open {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost && r.URL.Path == "/auth/register" {
				writeJSONError(w, http.StatusForbidden, "registration_closed", "registration is closed on this server")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
