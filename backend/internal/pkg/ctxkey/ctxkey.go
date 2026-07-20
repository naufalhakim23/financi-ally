// Package ctxkey defines typed context keys so packages sharing request-scoped
// values (the authenticated principal, later the sync watermark) never collide
// on bare strings.
package ctxkey

// Key is an unexported type — only this package can mint keys of this type,
// which makes the constants below impossible to forge from another package.
type Key string

const (
	// Auth holds the authenticated *auth.Principal for the current request.
	// Set by the auth middleware on protected routes; absent on public ones.
	Auth Key = "auth"
)
