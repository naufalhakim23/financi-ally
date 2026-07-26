// Package auth owns the authentication surface: email+password credentials,
// JWT access tokens, opaque rotated refresh tokens, and OAuth (Google) identity
// linking. It is feature-scoped and self-contained; the future service boundary
// if auth ever splits out.
package auth

import "time"

// User is the account record. PasswordHash is nil for OAuth-only users who
// have never set a password.
type User struct {
	ID           string
	Email        string
	PasswordHash *string
	BaseCurrency string
	CreatedAt    time.Time
}

// RefreshToken is the persisted (hashed) refresh-token row.
type RefreshToken struct {
	ID        string
	UserID    string
	TokenHash []byte
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}

// Principal is the authenticated identity placed in the request context by the
// auth middleware. It carries only what handlers need without re-hitting the DB.
type Principal struct {
	UserID string
	Email  string
}

// Session is what register/login/refresh/google return: a fresh access JWT,
// the one-and-only copy of a raw refresh token, and the user record.
type Session struct {
	AccessToken  string
	RefreshToken string
	User         *User
}
