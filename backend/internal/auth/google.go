package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GoogleService exchanges an authorization code (from the mobile app's
// expo-auth-session PKCE flow) for a verified Google identity. The client secret
// lives here on the server; the app only ever sees the authorization code.
type GoogleService struct {
	clientID     string
	clientSecret string
}

// NewGoogle builds the service. Empty clientID means disabled; callers should
// check Enabled() before presenting Google as an option.
func NewGoogle(clientID, clientSecret string) *GoogleService {
	return &GoogleService{clientID: clientID, clientSecret: clientSecret}
}

// Enabled reports whether Google OAuth is configured.
func (g *GoogleService) Enabled() bool { return g != nil && g.clientID != "" && g.clientSecret != "" }

const googleUserInfoURL = "https://www.googleapis.com/oauth2/v2/userinfo"

// userInfo is the subset of Google's userinfo response we rely on.
type userInfo struct {
	ID            string `json:"id"`             // stable subject identifier → provider_uid
	Email         string `json:"email"`
	EmailVerified bool   `json:"verified_email"` // v2 returns a real bool
}

// Exchange redeems the authorization code for tokens, then fetches userinfo.
// redirectURI must match the one the app used to build the auth URL (expo-auth-
// session's makeRedirect output). Returns ErrOAuthUnverifiedEmail if Google has
// not verified the address; we never mint our session on an unverified email.
func (g *GoogleService) Exchange(ctx context.Context, code, redirectURI string) (providerUID, email string, err error) {
	// Bound the round-trips to Google so a slow/unreachable Google can't hold a
	// request handler (and its pool connection) open to the chi 30s ceiling.
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	conf := &oauth2.Config{
		ClientID:     g.clientID,
		ClientSecret: g.clientSecret,
		RedirectURL:  redirectURI,
		Endpoint:     google.Endpoint,
		Scopes:       []string{"openid", "email"},
	}
	// Fresh config per call; RedirectURI varies by client/platform, so we can't
	// share one immutable config.
	tok, err := conf.Exchange(ctx, code)
	if err != nil {
		return "", "", fmt.Errorf("google code exchange: %w", err)
	}

	client := oauth2.NewClient(ctx, oauth2.StaticTokenSource(tok))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleUserInfoURL, nil)
	if err != nil {
		return "", "", fmt.Errorf("build userinfo request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("google userinfo: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", "", fmt.Errorf("google userinfo status %d: %s", resp.StatusCode, body)
	}

	var info userInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return "", "", fmt.Errorf("decode google userinfo: %w", err)
	}
	if info.ID == "" || info.Email == "" {
		return "", "", errors.New("google userinfo missing id or email")
	}
	if !info.EmailVerified {
		return "", "", ErrOAuthUnverifiedEmail
	}
	return info.ID, info.Email, nil
}
