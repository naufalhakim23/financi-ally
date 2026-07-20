package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Service-level sentinels. These wrap or complement repo errors so the handler
// layer maps a single auth-domain error vocabulary to HTTP statuses.
var (
	// ErrInvalidCredentials: wrong email/password. Deliberately identical for
	// "no such user" and "bad password" — never reveal which.
	ErrInvalidCredentials = errors.New("invalid credentials")
	// ErrInvalidInput: malformed email or too-short password at the service
	// trust boundary (defense in depth alongside OpenAPI binding).
	ErrInvalidInput = errors.New("invalid input")
	// ErrGoogleDisabled: Google OAuth not configured (empty client id).
	ErrGoogleDisabled = errors.New("google oauth not configured")
	// ErrOAuthUnverifiedEmail: Google returned an unverified email.
	ErrOAuthUnverifiedEmail = errors.New("oauth email not verified")
)

// minPasswordLen is enforced at the service trust boundary. OpenAPI also pins
// minLength:8; this is the backstop if Service is called outside HTTP later.
const minPasswordLen = 8

// Service orchestrates auth flows: hash + persist credentials, mint JWTs and
// refresh tokens, and bind OAuth identities to users. It owns the session shape
// so every path that logs a user in produces an identical response.
type Service struct {
	repo          *Repo
	jwt           *JWTService
	google        *GoogleService
	refreshTTL    time.Duration
	baseCurrency  string // default when register omits it
}

// NewService wires the service with its dependencies and policy knobs.
func NewService(repo *Repo, jwt *JWTService, google *GoogleService, refreshTTL time.Duration, baseCurrencyDefault string) *Service {
	return &Service{
		repo:         repo,
		jwt:          jwt,
		google:       google,
		refreshTTL:   refreshTTL,
		baseCurrency: baseCurrencyDefault,
	}
}

// Register creates a credential user and starts a session.
func (s *Service) Register(ctx context.Context, email, password, baseCurrency string) (*Session, error) {
	if !validEmail(email) || len(password) < minPasswordLen {
		return nil, ErrInvalidInput
	}
	if baseCurrency == "" {
		baseCurrency = s.baseCurrency
	} else {
		// ISO 4217 is 3 uppercase letters. Normalize + reject anything else at
		// the trust boundary so a malformed value can't reach the char(3) column
		// and surface as a generic 500.
		baseCurrency = strings.ToUpper(baseCurrency)
		if len(baseCurrency) != 3 {
			return nil, ErrInvalidInput
		}
	}

	hash, err := HashPassword(password)
	if err != nil {
		return nil, err
	}
	user, err := s.repo.CreateUser(ctx, email, &hash, baseCurrency)
	if err != nil {
		return nil, err // ErrEmailExists surfaces as-is
	}
	return s.issueSession(ctx, user)
}

// Login verifies credentials and starts a session. User-not-found and bad
// password both yield ErrInvalidCredentials.
func (s *Service) Login(ctx context.Context, email, password string) (*Session, error) {
	user, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if user.PasswordHash == nil {
		// OAuth-only account — no password to check. Surface the same error so
		// a password login attempt doesn't reveal that the email exists via OAuth.
		return nil, ErrInvalidCredentials
	}
	ok, err := VerifyPassword(*user.PasswordHash, password)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, ErrInvalidCredentials
	}
	return s.issueSession(ctx, user)
}

// Refresh rotates a refresh token: the presented token is revoked and a brand
// new access+refresh pair is issued. A replayed, expired, or forged token
// returns ErrInvalidToken (rotate is atomic — no half-state).
func (s *Service) Refresh(ctx context.Context, rawToken string) (*Session, error) {
	oldHash := hashToken(rawToken)
	newRaw, newHash, err := newRefreshToken()
	if err != nil {
		return nil, err
	}
	user, err := s.repo.RotateRefreshToken(ctx, oldHash, newHash, time.Now().Add(s.refreshTTL))
	if err != nil {
		return nil, err
	}
	access, _, err := s.jwt.Issue(user.ID, user.Email)
	if err != nil {
		return nil, err
	}
	return &Session{AccessToken: access, RefreshToken: newRaw, User: user}, nil
}

// Me returns the current user. Missing → ErrUserNotFound.
func (s *Service) Me(ctx context.Context, userID string) (*User, error) {
	return s.repo.GetUserByID(ctx, userID)
}

// Logout revokes the presented refresh token for the authenticated user.
func (s *Service) Logout(ctx context.Context, userID, rawToken string) error {
	return s.repo.RevokeRefreshToken(ctx, userID, hashToken(rawToken))
}

// GoogleLogin exchanges a Google authorization code (produced by the mobile
// app's PKCE flow) for a verified identity, find-or-creates the user, and
// starts a session. Returns ErrGoogleDisabled if Google isn't configured.
func (s *Service) GoogleLogin(ctx context.Context, code, redirectURI string) (*Session, error) {
	if s.google == nil || !s.google.Enabled() {
		return nil, ErrGoogleDisabled
	}
	providerUID, email, err := s.google.Exchange(ctx, code, redirectURI)
	if err != nil {
		return nil, err
	}
	user, err := s.repo.FindOrCreateOAuth(ctx, "google", providerUID, email)
	if err != nil {
		return nil, err
	}
	return s.issueSession(ctx, user)
}

// issueSession mints an access JWT and a fresh refresh token, persists the
// refresh hash, and returns the full session. Shared by every login path.
func (s *Service) issueSession(ctx context.Context, user *User) (*Session, error) {
	access, _, err := s.jwt.Issue(user.ID, user.Email)
	if err != nil {
		return nil, err
	}
	raw, hash, err := newRefreshToken()
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateRefreshToken(ctx, user.ID, hash, time.Now().Add(s.refreshTTL)); err != nil {
		return nil, err
	}
	return &Session{AccessToken: access, RefreshToken: raw, User: user}, nil
}

// newRefreshToken returns a raw opaque token (base64url, 256 bits of entropy)
// plus its sha256 hash for storage. Only the raw form ever leaves the server.
func newRefreshToken() (raw string, hash []byte, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", nil, fmt.Errorf("generate refresh token: %w", err)
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	return raw, hashToken(raw), nil
}

// hashToken is the one-way transform from raw refresh token to stored hash.
func hashToken(raw string) []byte {
	h := sha256.Sum256([]byte(raw))
	return h[:]
}

// validEmail is a deliberately cheap check — "non-empty, has one @, something
// each side". Authoritative format validation isn't the auth layer's job and
// exhaustive regexes reject valid addresses; we only guard against garbage.
func validEmail(s string) bool {
	at := -1
	for i, c := range s {
		if c == '@' {
			if at != -1 {
				return false // multiple @
			}
			at = i
		}
	}
	return at > 0 && at < len(s)-1
}
