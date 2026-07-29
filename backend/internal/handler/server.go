// Package handler implements the oapi-codegen-generated StrictServerInterface
// and hosts the auth middleware. M1: /healthz + the full /auth surface.
package handler

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
)

// ServerImpl implements api.StrictServerInterface.
type ServerImpl struct {
	db     *db.Pool
	svc    *auth.Service
	ledger *ledger.Service
}

// NewServerImpl wires the handler with its dependencies.
func NewServerImpl(pool *db.Pool, svc *auth.Service, led *ledger.Service) *ServerImpl {
	return &ServerImpl{db: pool, svc: svc, ledger: led}
}

// Compile-time interface satisfaction; breaks at build if the generated
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

// --- ledger handlers -------------------------------------------------------

// CreateAccount makes a pocket (asset/liability) or category (income/expense/equity).
func (s *ServerImpl) CreateAccount(ctx context.Context, req api.CreateAccountRequestObject) (api.CreateAccountResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.CreateAccount401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	id := ""
	if req.Body.Id != nil {
		id = *req.Body.Id
	}
	a, err := s.ledger.CreateAccount(ctx, p.UserID, id, string(req.Body.Type), req.Body.Currency, req.Body.Name, req.Body.ParentId)
	switch {
	case errors.Is(err, ledger.ErrInvalidInput):
		return api.CreateAccount400JSONResponse(api.Error{Code: "invalid_input", Message: "invalid type, currency, or name"}), nil
	case errors.Is(err, ledger.ErrAccountNameExists):
		return api.CreateAccount409JSONResponse(api.Error{Code: "account_exists", Message: "an account of this type with this name already exists"}), nil
	case err != nil:
		return nil, err
	}
	return api.CreateAccount201JSONResponse(toAPIAccount(a)), nil
}

// ListAccounts returns the user's accounts, optionally filtered by type.
func (s *ServerImpl) ListAccounts(ctx context.Context, req api.ListAccountsRequestObject) (api.ListAccountsResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListAccounts401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	typeFilter := ""
	if req.Params.Type != nil {
		typeFilter = string(*req.Params.Type)
	}
	accounts, err := s.ledger.ListAccounts(ctx, p.UserID, typeFilter)
	if err != nil {
		return nil, err
	}
	out := make([]api.Account, 0, len(accounts))
	for _, a := range accounts {
		out = append(out, toAPIAccount(a))
	}
	return api.ListAccounts200JSONResponse(out), nil
}

// GetAccountBalance returns debit/credit totals and the signed balance.
func (s *ServerImpl) GetAccountBalance(ctx context.Context, req api.GetAccountBalanceRequestObject) (api.GetAccountBalanceResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetAccountBalance401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	bal, err := s.ledger.Balance(ctx, p.UserID, req.Id)
	if errors.Is(err, ledger.ErrAccountNotFound) {
		return api.GetAccountBalance404JSONResponse(api.Error{Code: "not_found", Message: "account not found"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.GetAccountBalance200JSONResponse(api.AccountBalance{
		AccountId:   req.Id,
		Currency:    bal.Currency,
		DebitMinor:  bal.DebitMinor,
		CreditMinor: bal.CreditMinor,
		SignedMinor: bal.SignedMinor,
	}), nil
}

// PostEntry writes a balanced double-entry transaction.
func (s *ServerImpl) PostEntry(ctx context.Context, req api.PostEntryRequestObject) (api.PostEntryResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.PostEntry401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	in := ledger.EntryInput{Currency: req.Body.Currency}
	if req.Body.Id != nil {
		in.ID = *req.Body.Id
	}
	if req.Body.TxnDate != nil {
		in.TxnDate = req.Body.TxnDate.Time
	}
	if req.Body.FxRate != nil {
		fx := *req.Body.FxRate
		in.FXRate = &fx
	}
	if req.Body.Memo != nil {
		in.Memo = *req.Body.Memo
	}
	if req.Body.Source != nil {
		in.Source = string(*req.Body.Source)
	}
	for _, ln := range req.Body.Lines {
		lid := ""
		if ln.Id != nil {
			lid = *ln.Id
		}
		line := ledger.LineInput{
			ID:          lid,
			AccountID:   ln.AccountId,
			DC:          ledger.DC(string(ln.Dc)),
			AmountMinor: ln.AmountMinor,
		}
		if ln.Currency != nil {
			line.Currency = *ln.Currency
		}
		in.Lines = append(in.Lines, line)
	}
	e, err := s.ledger.Post(ctx, p.UserID, in)
	switch {
	case errors.Is(err, ledger.ErrInvalidInput):
		return api.PostEntry400JSONResponse(api.Error{Code: "invalid_input", Message: "invalid entry: check currency, line amounts, and account ownership"}), nil
	case errors.Is(err, ledger.ErrUnbalancedEntry):
		return api.PostEntry422JSONResponse(api.Error{Code: "unbalanced", Message: "entry debits do not equal credits"}), nil
	case err != nil:
		return nil, err
	}
	return api.PostEntry201JSONResponse(toAPIEntry(e)), nil
}

// ListEntries returns posted entries (with lines) within an optional date range.
func (s *ServerImpl) ListEntries(ctx context.Context, req api.ListEntriesRequestObject) (api.ListEntriesResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListEntries401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	var from, to *time.Time
	if req.Params.From != nil {
		t := req.Params.From.Time
		from = &t
	}
	if req.Params.To != nil {
		t := req.Params.To.Time
		to = &t
	}
	entries, err := s.ledger.ListEntries(ctx, p.UserID, from, to)
	if err != nil {
		return nil, err
	}
	out := make([]api.Entry, 0, len(entries))
	for _, e := range entries {
		out = append(out, toAPIEntry(e))
	}
	return api.ListEntries200JSONResponse(out), nil
}

// GetEntry fetches one entry with its lines.
func (s *ServerImpl) GetEntry(ctx context.Context, req api.GetEntryRequestObject) (api.GetEntryResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetEntry401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	e, err := s.ledger.GetEntry(ctx, p.UserID, req.Id)
	if errors.Is(err, ledger.ErrEntryNotFound) {
		return api.GetEntry404JSONResponse(api.Error{Code: "not_found", Message: "entry not found"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.GetEntry200JSONResponse(toAPIEntry(e)), nil
}

// --- mappers ---------------------------------------------------------------

func toAPIAccount(a *ledger.Account) api.Account {
	return api.Account{
		Id:        a.ID,
		Type:      api.AccountType(a.Type),
		Currency:  a.Currency,
		Name:      a.Name,
		ParentId:  a.ParentID,
		Archived:  a.Archived,
		CreatedAt: a.CreatedAt,
		UpdatedAt: a.UpdatedAt,
	}
}

func toAPIEntry(e *ledger.Entry) api.Entry {
	lines := make([]api.JournalLine, 0, len(e.Lines))
	for _, ln := range e.Lines {
		lines = append(lines, api.JournalLine{
			Id:          ln.ID,
			EntryId:     ln.EntryID,
			AccountId:   ln.AccountID,
			Dc:          api.JournalLineDc(ln.DC),
			AmountMinor: ln.AmountMinor,
			Currency:    ln.Currency,
		})
	}
	return api.Entry{
		Id:        e.ID,
		TxnDate:   openapi_types.Date{Time: e.TxnDate},
		Status:    api.EntryStatus(e.Status),
		Currency:  e.Currency,
		FxRate:    e.FXRate,
		Source:    api.EntrySource(e.Source),
		Memo:      e.Memo,
		Lines:     lines,
		CreatedAt: e.CreatedAt,
		UpdatedAt: e.UpdatedAt,
	}
}
