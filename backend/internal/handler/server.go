// Package handler implements the oapi-codegen-generated StrictServerInterface
// and hosts the auth middleware. M1: /healthz + the full /auth surface.
package handler

import (
	"context"
	"errors"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
)

// ServerImpl implements api.StrictServerInterface.
type ServerImpl struct {
	db  *db.Pool
	svc *auth.Service
}

// NewServerImpl wires the handler with its dependencies.
func NewServerImpl(pool *db.Pool, svc *auth.Service) *ServerImpl {
	return &ServerImpl{db: pool, svc: svc}
}

// Compile-time interface satisfaction — breaks at build if the generated
// strict interface drifts from our impl.
var _ api.StrictServerInterface = (*ServerImpl)(nil)

// GetHealthz is the liveness + DB-connectivity probe.
// 200 {"status":"ok","db":"up"} when Postgres answers; 503 {"db":"down"} when not.
func (s *ServerImpl) GetHealthz(ctx context.Context, _ api.GetHealthzRequestObject) (api.GetHealthzResponseObject, error) {
	status := api.Up
	if err := s.db.Ping(ctx); err != nil {
		status = api.Down
	}
	body := api.HealthStatus{Status: "ok", Db: status}
	if status == api.Down {
		return api.GetHealthz503JSONResponse(body), nil
	}
	return api.GetHealthz200JSONResponse(body), nil
}

// Register creates a credential account and starts a session.
func (s *ServerImpl) Register(ctx context.Context, req api.RegisterRequestObject) (api.RegisterResponseObject, error) {
	baseCur := ""
	if req.Body != nil && req.Body.BaseCurrency != nil {
		baseCur = *req.Body.BaseCurrency
	}
	sess, err := s.svc.Register(ctx, string(req.Body.Email), req.Body.Password, baseCur)
	switch {
	case errors.Is(err, auth.ErrInvalidInput):
		return api.Register400JSONResponse(api.Error{Code: "invalid_input", Message: "email and a password of at least 8 characters are required"}), nil
	case errors.Is(err, auth.ErrEmailExists):
		return api.Register409JSONResponse(api.Error{Code: "email_exists", Message: "email already registered"}), nil
	case err != nil:
		return nil, err
	}
	resp, err := toAPIAuth(sess)
	if err != nil {
		return nil, err
	}
	return api.Register200JSONResponse(resp), nil
}

// Login exchanges credentials for a session.
func (s *ServerImpl) Login(ctx context.Context, req api.LoginRequestObject) (api.LoginResponseObject, error) {
	sess, err := s.svc.Login(ctx, string(req.Body.Email), req.Body.Password)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		return api.Login401JSONResponse(api.Error{Code: "invalid_credentials", Message: "invalid credentials"}), nil
	}
	if err != nil {
		return nil, err
	}
	resp, err := toAPIAuth(sess)
	if err != nil {
		return nil, err
	}
	return api.Login200JSONResponse(resp), nil
}

// Refresh rotates a refresh token into a new session.
func (s *ServerImpl) Refresh(ctx context.Context, req api.RefreshRequestObject) (api.RefreshResponseObject, error) {
	sess, err := s.svc.Refresh(ctx, req.Body.RefreshToken)
	if errors.Is(err, auth.ErrInvalidToken) {
		return api.Refresh401JSONResponse(api.Error{Code: "invalid_token", Message: "refresh token invalid, expired, or already used"}), nil
	}
	if err != nil {
		return nil, err
	}
	resp, err := toAPIAuth(sess)
	if err != nil {
		return nil, err
	}
	return api.Refresh200JSONResponse(resp), nil
}

// GoogleAuth exchanges a Google authorization code for a session.
func (s *ServerImpl) GoogleAuth(ctx context.Context, req api.GoogleAuthRequestObject) (api.GoogleAuthResponseObject, error) {
	sess, err := s.svc.GoogleLogin(ctx, req.Body.Code, req.Body.RedirectUri)
	switch {
	case errors.Is(err, auth.ErrGoogleDisabled):
		return api.GoogleAuth503JSONResponse(api.Error{Code: "google_disabled", Message: "google oauth is not configured on the server"}), nil
	case errors.Is(err, auth.ErrOAuthUnverifiedEmail), errors.Is(err, auth.ErrInvalidToken):
		return api.GoogleAuth401JSONResponse(api.Error{Code: "google_rejected", Message: "google rejected the code or email is unverified"}), nil
	case err != nil:
		return nil, err
	}
	resp, err := toAPIAuth(sess)
	if err != nil {
		return nil, err
	}
	return api.GoogleAuth200JSONResponse(resp), nil
}

// GetMe returns the authenticated user. The middleware guarantees a principal
// is present; a missing user row (deleted mid-session) still maps to 401.
func (s *ServerImpl) GetMe(ctx context.Context, _ api.GetMeRequestObject) (api.GetMeResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetMe401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	user, err := s.svc.Me(ctx, p.UserID)
	if errors.Is(err, auth.ErrUserNotFound) {
		return api.GetMe401JSONResponse(api.Error{Code: "unauthenticated", Message: "user no longer exists"}), nil
	}
	if err != nil {
		return nil, err
	}
	u, err := toAPIUser(user)
	if err != nil {
		return nil, err
	}
	return api.GetMe200JSONResponse(u), nil
}

// Logout revokes the presented refresh token. Idempotent: an unknown or
// already-revoked token still returns 204.
func (s *ServerImpl) Logout(ctx context.Context, req api.LogoutRequestObject) (api.LogoutResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.Logout401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	if err := s.svc.Logout(ctx, p.UserID, req.Body.RefreshToken); err != nil {
		return nil, err
	}
	return api.Logout204Response{}, nil
}

// toAPIUser maps a domain user to the API model, parsing the uuid.
func toAPIUser(u *auth.User) (api.User, error) {
	id, err := uuid.Parse(u.ID)
	if err != nil {
		return api.User{}, err
	}
	return api.User{
		Id:           id,
		Email:        openapi_types.Email(u.Email),
		BaseCurrency: u.BaseCurrency,
		CreatedAt:    u.CreatedAt,
	}, nil
}

// toAPIAuth maps a domain session to the API auth response.
func toAPIAuth(sess *auth.Session) (api.AuthResponse, error) {
	u, err := toAPIUser(sess.User)
	if err != nil {
		return api.AuthResponse{}, err
	}
	return api.AuthResponse{
		AccessToken:  sess.AccessToken,
		RefreshToken: sess.RefreshToken,
		User:         u,
	}, nil
}
