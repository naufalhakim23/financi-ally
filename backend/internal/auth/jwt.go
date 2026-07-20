package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Errors surfaced by JWT verification. Callers map these to 401.
var (
	ErrInvalidToken = errors.New("invalid token")
	ErrExpiredToken = errors.New("token expired")
)

// JWTClaims carries the user identity in the access token. UserID is the only
// field the backend trusts for authorization; Email is convenience for logging.
type JWTClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// JWTService issues and verifies HS256 access tokens. Symmetric HS256 is the
// right call while a single backend verifies tokens; if a second verifier
// appears (a sync worker, a separate service), flip to RS256 + a keypair.
type JWTService struct {
	secret    []byte
	accessTTL time.Duration
}

// NewJWTService builds a JWT issuer. The caller (config) guarantees secret is
// non-default in production.
func NewJWTService(secret string, accessTTL time.Duration) *JWTService {
	return &JWTService{secret: []byte(secret), accessTTL: accessTTL}
}

// Issue mints a signed access token for the user. Returns the token and its
// expiry so callers can echo TTL to clients if useful.
func (j *JWTService) Issue(userID, email string) (string, time.Time, error) {
	now := time.Now()
	exp := now.Add(j.accessTTL)
	claims := JWTClaims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(exp),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Subject:   userID,
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := tok.SignedString(j.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign jwt: %w", err)
	}
	return signed, exp, nil
}

// Verify validates signature + expiry. A bad signature or expired token yields
// a typed error; callers should treat both as 401 and not distinguish to clients.
func (j *JWTService) Verify(tokenString string) (*JWTClaims, error) {
	claims := &JWTClaims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return j.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}
	return claims, nil
}
