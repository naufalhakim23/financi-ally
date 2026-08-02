package handler

import (
	"context"
	"net/http"

	"github.com/naufalhakim23/financi-ally/backend/api"
)

// Refresh-token-in-a-cookie support for the browser client.
//
// Why a cookie at all: the web app keeps its access token in memory only, so a
// page reload has nothing to authenticate with. Parking the *refresh* token in
// localStorage instead would mean one XSS is a permanent account takeover on a
// finance app. An httpOnly cookie is unreadable to script, and because the SPA
// is served same-origin behind a reverse proxy it costs nothing — no CORS, no
// SameSite=None.
//
// Why a strict middleware rather than per-handler code: the handlers already
// own the one refresh path (auth.Service.Refresh does the rotation), and the
// only thing that differs for a browser is *where* the token is read from and
// whether a Set-Cookie rides along. Keeping that in one place is what stops the
// two shapes from drifting — two refresh implementations means one of them
// silently stops rotating.
//
// Mobile is untouched: it sends and receives the token in the body, which every
// response still carries.

const (
	// refreshCookieName is namespaced so it can't collide with anything else on
	// the origin.
	refreshCookieName = "fa_refresh"

	// refreshCookiePath scopes the cookie to the auth routes *as the browser
	// sees them* — the SPA is served at `/` and the API is proxied under `/api`.
	// Combined with SameSite=Lax it means the cookie only ever rides
	// refresh/logout, so a cross-site form post can't trigger a money mutation:
	// those need the Bearer header, which an attacker's page cannot read. That
	// is why there is no separate CSRF token.
	refreshCookiePath = "/api/auth"
)

// WebCookieAuth returns a strict middleware that mirrors the refresh token into
// an httpOnly cookie on every path that mints a session, reads it back on
// refresh/logout when the body omits one, and clears it on logout.
//
// secure should be false only for plain-HTTP local development; a Secure cookie
// is not stored by the browser over http://.
func WebCookieAuth(secure bool) api.StrictMiddlewareFunc {
	return func(next api.StrictHandlerFunc, operationID string) api.StrictHandlerFunc {
		// oapi-codegen passes the Go handler name, not the contract's
		// operationId — "Refresh", not "refresh".
		switch operationID {
		case "Register", "Login", "GoogleAuth", "ResetPassword", "Refresh", "Logout":
		default:
			return next
		}
		return func(ctx context.Context, w http.ResponseWriter, r *http.Request, request any) (any, error) {
			request = withCookieToken(r, operationID, request)

			resp, err := next(ctx, w, r, request)
			if err != nil {
				return resp, err
			}

			if operationID == "Logout" {
				if _, ok := resp.(api.Logout204Response); ok {
					clearRefreshCookie(w, secure)
				}
				return resp, nil
			}
			if token, ok := issuedRefreshToken(resp); ok {
				setRefreshCookie(w, token, secure)
			}
			return resp, nil
		}
	}
}

// withCookieToken fills in a refresh/logout body from the cookie when the
// caller supplied none. A body that carries its own token wins — that is the
// mobile shape, and it must keep working with cookies present.
func withCookieToken(r *http.Request, operationID string, request any) any {
	if operationID != "Refresh" && operationID != "Logout" {
		return request
	}
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil || cookie.Value == "" {
		return request
	}
	switch req := request.(type) {
	case api.RefreshRequestObject:
		if refreshTokenOf(req.Body) == "" {
			req.Body = &api.RefreshJSONRequestBody{RefreshToken: &cookie.Value}
		}
		return req
	case api.LogoutRequestObject:
		if refreshTokenOf(req.Body) == "" {
			req.Body = &api.LogoutJSONRequestBody{RefreshToken: &cookie.Value}
		}
		return req
	}
	return request
}

// refreshTokenOf reads the token out of a refresh/logout body, treating both an
// absent body and an absent field as "nothing supplied". Shared with the auth
// handlers, which face the same optional field.
func refreshTokenOf(body *api.RefreshRequest) string {
	if body == nil || body.RefreshToken == nil {
		return ""
	}
	return *body.RefreshToken
}

// issuedRefreshToken pulls the newly minted refresh token out of whichever
// success response the operation produced. Every session-minting response is
// the same AuthResponse under a different name, so this is a type switch rather
// than five near-identical middlewares.
func issuedRefreshToken(resp any) (string, bool) {
	switch v := resp.(type) {
	case api.Register200JSONResponse:
		return v.RefreshToken, true
	case api.Login200JSONResponse:
		return v.RefreshToken, true
	case api.GoogleAuth200JSONResponse:
		return v.RefreshToken, true
	case api.Refresh200JSONResponse:
		return v.RefreshToken, true
	case api.ResetPassword200JSONResponse:
		// A reset revokes every other session and starts a new one, so the
		// browser must come away signed in on this device.
		return v.RefreshToken, true
	}
	return "", false
}

func setRefreshCookie(w http.ResponseWriter, token string, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    token,
		Path:     refreshCookiePath,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		// No Expires/MaxAge: a session cookie. The refresh token's own TTL is
		// the authority on how long a session lives, and the server can revoke
		// it — a long-lived cookie would only lie about that.
	})
}

func clearRefreshCookie(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     refreshCookiePath,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
}
