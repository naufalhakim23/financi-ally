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
	"github.com/naufalhakim23/financi-ally/backend/internal/budget"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
	"github.com/naufalhakim23/financi-ally/backend/internal/fx"
	"github.com/naufalhakim23/financi-ally/backend/internal/household"
	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
	"github.com/naufalhakim23/financi-ally/backend/internal/recurring"
	"github.com/naufalhakim23/financi-ally/backend/internal/reporting"
	syncpkg "github.com/naufalhakim23/financi-ally/backend/internal/sync"
)

// ServerImpl implements api.StrictServerInterface.
type ServerImpl struct {
	db        *db.Pool
	svc       *auth.Service
	ledger    *ledger.Service
	budget    *budget.Service
	syncSvc   *syncpkg.Service
	fxSvc     *fx.Service
	reportSvc *reporting.Service
	recSvc    *recurring.Service
	household *household.Service
}

// NewServerImpl wires the handler with its dependencies.
func NewServerImpl(pool *db.Pool, svc *auth.Service, led *ledger.Service, bud *budget.Service, syn *syncpkg.Service, fxSvc *fx.Service, reportSvc *reporting.Service, recSvc *recurring.Service, hs *household.Service) *ServerImpl {
	return &ServerImpl{db: pool, svc: svc, ledger: led, budget: bud, syncSvc: syn, fxSvc: fxSvc, reportSvc: reportSvc, recSvc: recSvc, household: hs}
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

// ForgotPassword emails a reset code. Always 204: a 404 for an unregistered
// address would let anyone probe which emails have accounts.
func (s *ServerImpl) ForgotPassword(ctx context.Context, req api.ForgotPasswordRequestObject) (api.ForgotPasswordResponseObject, error) {
	err := s.svc.RequestPasswordReset(ctx, string(req.Body.Email))
	if errors.Is(err, auth.ErrInvalidInput) {
		return api.ForgotPassword400JSONResponse(api.Error{Code: "invalid_input", Message: "a valid email address is required"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.ForgotPassword204Response{}, nil
}

// ResetPassword sets a new password from an emailed code and signs the caller
// in. Wrong / expired / exhausted codes are one indistinguishable 401.
func (s *ServerImpl) ResetPassword(ctx context.Context, req api.ResetPasswordRequestObject) (api.ResetPasswordResponseObject, error) {
	sess, err := s.svc.ResetPassword(ctx, string(req.Body.Email), req.Body.Code, req.Body.Password)
	switch {
	case errors.Is(err, auth.ErrInvalidInput):
		return api.ResetPassword400JSONResponse(api.Error{Code: "invalid_input", Message: "a password of at least 8 characters is required"}), nil
	case errors.Is(err, auth.ErrInvalidResetCode):
		return api.ResetPassword401JSONResponse(api.Error{Code: "invalid_code", Message: "that code is wrong, expired, or already used"}), nil
	case err != nil:
		return nil, err
	}
	resp, err := toAPIAuth(sess)
	if err != nil {
		return nil, err
	}
	return api.ResetPassword200JSONResponse(resp), nil
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
	a, err := s.ledger.CreateAccount(ctx, p.LedgerID, id, string(req.Body.Type), req.Body.Currency, req.Body.Name, req.Body.ParentId)
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

// ListAccounts returns the active book's accounts, optionally filtered by type.
func (s *ServerImpl) ListAccounts(ctx context.Context, req api.ListAccountsRequestObject) (api.ListAccountsResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListAccounts401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	typeFilter := ""
	if req.Params.Type != nil {
		typeFilter = string(*req.Params.Type)
	}
	accounts, err := s.ledger.ListAccounts(ctx, p.LedgerID, typeFilter)
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
	bal, err := s.ledger.Balance(ctx, p.LedgerID, req.Id)
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
	e, err := s.ledger.Post(ctx, p.LedgerID, p.UserID, in)
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
	entries, err := s.ledger.ListEntries(ctx, p.LedgerID, from, to)
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
	e, err := s.ledger.GetEntry(ctx, p.LedgerID, req.Id)
	if errors.Is(err, ledger.ErrEntryNotFound) {
		return api.GetEntry404JSONResponse(api.Error{Code: "not_found", Message: "entry not found"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.GetEntry200JSONResponse(toAPIEntry(e)), nil
}

// --- budget handlers -------------------------------------------------------

// SetBudget creates or updates a monthly category budget.
func (s *ServerImpl) SetBudget(ctx context.Context, req api.SetBudgetRequestObject) (api.SetBudgetResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.SetBudget401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	id := ""
	if req.Body.Id != nil {
		id = *req.Body.Id
	}
	b, err := s.budget.Set(ctx, p.LedgerID, id, req.Body.AccountId, req.Body.PeriodMonth.Time, req.Body.TargetMinor)
	if errors.Is(err, budget.ErrInvalidInput) {
		return api.SetBudget400JSONResponse(api.Error{Code: "invalid_input", Message: "account must be an owned expense account; period must be month-start"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.SetBudget200JSONResponse(toAPIBudget(b)), nil
}

// ListBudgets returns a month's budgets with live spent totals.
func (s *ServerImpl) ListBudgets(ctx context.Context, req api.ListBudgetsRequestObject) (api.ListBudgetsResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListBudgets401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	if req.Params.Period.Time.IsZero() {
		return api.ListBudgets400JSONResponse(api.Error{Code: "invalid_input", Message: "period query param is required (YYYY-MM-01)"}), nil
	}
	bs, err := s.budget.List(ctx, p.LedgerID, req.Params.Period.Time)
	if errors.Is(err, budget.ErrInvalidInput) {
		return api.ListBudgets400JSONResponse(api.Error{Code: "invalid_input", Message: "period must be a valid month-start date"}), nil
	}
	if err != nil {
		return nil, err
	}
	out := make([]api.BudgetWithSpent, 0, len(bs))
	for _, b := range bs {
		out = append(out, api.BudgetWithSpent{
			Id:          b.ID,
			AccountId:   b.AccountID,
			PeriodMonth: openapi_types.Date{Time: b.PeriodMonth},
			TargetMinor: b.TargetMinor,
			SpentMinor:  b.SpentMinor,
			Currency:    b.Currency,
			CreatedAt:   b.CreatedAt,
			UpdatedAt:   b.UpdatedAt,
		})
	}
	return api.ListBudgets200JSONResponse(out), nil
}

// UpdateBudget changes a budget's target.
func (s *ServerImpl) UpdateBudget(ctx context.Context, req api.UpdateBudgetRequestObject) (api.UpdateBudgetResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.UpdateBudget401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	b, err := s.budget.UpdateTarget(ctx, p.LedgerID, req.Id, req.Body.TargetMinor)
	if errors.Is(err, budget.ErrBudgetNotFound) || errors.Is(err, budget.ErrInvalidInput) {
		return api.UpdateBudget404JSONResponse(api.Error{Code: "not_found", Message: "budget not found"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.UpdateBudget200JSONResponse(toAPIBudget(b)), nil
}

// DeleteBudget removes a budget (idempotent).
func (s *ServerImpl) DeleteBudget(ctx context.Context, req api.DeleteBudgetRequestObject) (api.DeleteBudgetResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.DeleteBudget401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	if err := s.budget.Delete(ctx, p.LedgerID, req.Id); err != nil {
		return nil, err
	}
	return api.DeleteBudget204Response{}, nil
}

// --- sync handlers ---------------------------------------------------------

// SyncPull returns changes since the client's watermark.
func (s *ServerImpl) SyncPull(ctx context.Context, req api.SyncPullRequestObject) (api.SyncPullResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.SyncPull401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	var since int64
	if req.Params.LastPulledAt != nil {
		since = *req.Params.LastPulledAt
	}
	resp, err := s.syncSvc.Pull(ctx, p.LedgerID, since)
	if err != nil {
		return nil, err
	}
	return api.SyncPull200JSONResponse(api.SyncPullResponse{
		Changes:   toAPIChanges(resp.Changes),
		Timestamp: resp.Timestamp,
	}), nil
}

// SyncPush applies client changes; per-record failures are returned, never dropped.
func (s *ServerImpl) SyncPush(ctx context.Context, req api.SyncPushRequestObject) (api.SyncPushResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.SyncPush401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	resp, err := s.syncSvc.Push(ctx, p.LedgerID, p.UserID, syncpkg.PushRequest{Changes: fromAPIChanges(req.Body.Changes)})
	if err != nil {
		return nil, err
	}
	out := api.SyncPushResponse{}
	if len(resp.Errors) > 0 {
		errs := resp.Errors
		out.Errors = &errs
	}
	return api.SyncPush200JSONResponse(out), nil
}

// --- FX handlers -----------------------------------------------------------

// ListFxRates returns available FX rates for the latest loaded day.
func (s *ServerImpl) ListFxRates(ctx context.Context, _ api.ListFxRatesRequestObject) (api.ListFxRatesResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListFxRates401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	_ = p
	bases, err := s.fxSvc.BaseCurrencies(ctx)
	if err != nil {
		return nil, err
	}
	rates := make([]api.FxRate, 0)
	var latestDay time.Time
	for _, base := range bases {
		day, err := s.fxSvc.LatestDay(ctx, base)
		if err != nil {
			return nil, err
		}
		if day.After(latestDay) {
			latestDay = day
		}
	}
	if !latestDay.IsZero() {
		for _, base := range bases {
			dayRates, err := s.fxSvc.DayRates(ctx, base, latestDay)
			if err != nil {
				return nil, err
			}
			for _, r := range dayRates {
				rates = append(rates, api.FxRate{
					Base:   r.Base,
					Quote:  r.Quote,
					Day:    openapi_types.Date{Time: r.Day},
					Rate:   r.Rate,
					Source: r.Source,
				})
			}
		}
	}
	return api.ListFxRates200JSONResponse(api.FxRateList{Rates: rates, AsOf: openapi_types.Date{Time: time.Now()}}), nil
}

// RefreshFxRates triggers a manual FX rate refresh.
func (s *ServerImpl) RefreshFxRates(ctx context.Context, _ api.RefreshFxRatesRequestObject) (api.RefreshFxRatesResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.RefreshFxRates401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	_ = p
	if err := s.fxSvc.RefreshDaily(ctx, []string{"EUR", "USD", "IDR"}); err != nil {
		return nil, err
	}
	return api.RefreshFxRates200JSONResponse(api.FxRefreshResult{Count: 1}), nil
}

// GetFxRate returns the most recent rate for a currency pair.
func (s *ServerImpl) GetFxRate(ctx context.Context, req api.GetFxRateRequestObject) (api.GetFxRateResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetFxRate401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	_ = p
	asOf := time.Now()
	if req.Params.AsOf != nil {
		asOf = req.Params.AsOf.Time
	}
	rate, err := s.fxSvc.AtOrBefore(ctx, req.Base, req.Quote, asOf)
	if err != nil || rate == nil {
		return api.GetFxRate404JSONResponse(api.Error{Code: "not_found", Message: "no rate available for this pair"}), nil
	}
	return api.GetFxRate200JSONResponse(api.FxRate{
		Base:   rate.Base,
		Quote:  rate.Quote,
		Day:    openapi_types.Date{Time: rate.Day},
		Rate:   rate.Rate,
		Source: rate.Source,
	}), nil
}

// --- reporting handlers ----------------------------------------------------

// GetNetWorth returns assets minus liabilities, normalized to base currency.
func (s *ServerImpl) GetNetWorth(ctx context.Context, _ api.GetNetWorthRequestObject) (api.GetNetWorthResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetNetWorth401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	nw, err := s.reportSvc.NetWorth(ctx, p.LedgerID, p.LedgerCurrency)
	if err != nil {
		return nil, err
	}
	return api.GetNetWorth200JSONResponse(api.NetWorth{
		BaseCurrency: nw.BaseCurrency,
		AsOfDate:     nw.AsOfDate,
		TotalAsset: api.NormalizedAmount{
			RawMinor:  nw.TotalAsset.RawMinor,
			Currency:  nw.TotalAsset.Currency,
			BaseMinor: nw.TotalAsset.BaseMinor,
		},
		TotalLiability: api.NormalizedAmount{
			RawMinor:  nw.TotalLiability.RawMinor,
			Currency:  nw.TotalLiability.Currency,
			BaseMinor: nw.TotalLiability.BaseMinor,
		},
		NetMinor: nw.NetMinor,
	}), nil
}

// GetSpending returns spending by category for a period.
func (s *ServerImpl) GetSpending(ctx context.Context, req api.GetSpendingRequestObject) (api.GetSpendingResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetSpending401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	if req.Params.From.Time.IsZero() || req.Params.To.Time.IsZero() {
		return api.GetSpending400JSONResponse(api.Error{Code: "invalid_input", Message: "from and to are required"}), nil
	}
	spending, err := s.reportSvc.SpendingByCategory(ctx, p.LedgerID, p.LedgerCurrency, req.Params.From.Time, req.Params.To.Time)
	if err != nil {
		return nil, err
	}
	out := make([]api.CategorySpend, 0, len(spending))
	for _, c := range spending {
		out = append(out, api.CategorySpend{
			AccountId:   c.AccountID,
			AccountName: c.AccountName,
			Currency:    c.Currency,
			SpentMinor:  c.SpentMinor,
			BaseMinor:   c.BaseMinor,
		})
	}
	return api.GetSpending200JSONResponse(out), nil
}

// GetCashFlow returns income vs expense for a period.
func (s *ServerImpl) GetCashFlow(ctx context.Context, req api.GetCashFlowRequestObject) (api.GetCashFlowResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetCashFlow401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	if req.Params.From.Time.IsZero() || req.Params.To.Time.IsZero() {
		return api.GetCashFlow400JSONResponse(api.Error{Code: "invalid_input", Message: "from and to are required"}), nil
	}
	cf, err := s.reportSvc.CashFlow(ctx, p.LedgerID, p.LedgerCurrency, req.Params.From.Time, req.Params.To.Time)
	if err != nil {
		return nil, err
	}
	return api.GetCashFlow200JSONResponse(api.CashFlow{
		BaseCurrency: cf.BaseCurrency,
		PeriodStart:  openapi_types.Date{Time: cf.PeriodStart},
		PeriodEnd:    openapi_types.Date{Time: cf.PeriodEnd},
		IncomeMinor: api.NormalizedAmount{
			RawMinor:  cf.IncomeMinor.RawMinor,
			Currency:  cf.IncomeMinor.Currency,
			BaseMinor: cf.IncomeMinor.BaseMinor,
		},
		ExpenseMinor: api.NormalizedAmount{
			RawMinor:  cf.ExpenseMinor.RawMinor,
			Currency:  cf.ExpenseMinor.Currency,
			BaseMinor: cf.ExpenseMinor.BaseMinor,
		},
		NetMinor: cf.NetMinor,
	}), nil
}

// GetMonthlySeries returns the trailing income/expense/net trend by month.
func (s *ServerImpl) GetMonthlySeries(ctx context.Context, req api.GetMonthlySeriesRequestObject) (api.GetMonthlySeriesResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetMonthlySeries401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	months := 6
	if req.Params.Months != nil {
		months = *req.Params.Months
	}
	if months < 1 || months > 24 {
		return api.GetMonthlySeries400JSONResponse(api.Error{Code: "invalid_input", Message: "months must be between 1 and 24"}), nil
	}
	points, err := s.reportSvc.MonthlySeries(ctx, p.LedgerID, p.LedgerCurrency, months)
	if err != nil {
		return nil, err
	}
	out := make([]api.MonthlyPoint, 0, len(points))
	for _, pt := range points {
		out = append(out, api.MonthlyPoint{
			Month:        openapi_types.Date{Time: pt.Month},
			IncomeMinor:  pt.IncomeMinor,
			ExpenseMinor: pt.ExpenseMinor,
			NetMinor:     pt.NetMinor,
		})
	}
	return api.GetMonthlySeries200JSONResponse(api.MonthlySeries{
		BaseCurrency: p.LedgerCurrency,
		Points:       out,
	}), nil
}

// --- recurring handlers ----------------------------------------------------

// ListRecurring returns the active book's recurring transaction rules.
func (s *ServerImpl) ListRecurring(ctx context.Context, _ api.ListRecurringRequestObject) (api.ListRecurringResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ListRecurring401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	rules, err := s.recSvc.List(ctx, p.LedgerID)
	if err != nil {
		return nil, err
	}
	out := make([]api.RecurringRule, 0, len(rules))
	for _, r := range rules {
		out = append(out, toAPIRecurringRule(r))
	}
	return api.ListRecurring200JSONResponse(out), nil
}

// CreateRecurring creates a new recurring rule.
func (s *ServerImpl) CreateRecurring(ctx context.Context, req api.CreateRecurringRequestObject) (api.CreateRecurringResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.CreateRecurring401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	id := ""
	if req.Body.Id != nil {
		id = *req.Body.Id
	}
	active := true
	if req.Body.Active != nil {
		active = *req.Body.Active
	}
	rule, err := s.recSvc.Create(ctx, p.LedgerID, id, req.Body.Rrule, fromAPITemplate(req.Body.Template), active)
	if code, msg, bad := recurringInputError(err); bad {
		return api.CreateRecurring400JSONResponse(api.Error{Code: code, Message: msg}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.CreateRecurring201JSONResponse(toAPIRecurringRule(rule)), nil
}

// GetRecurring returns one recurring rule.
func (s *ServerImpl) GetRecurring(ctx context.Context, req api.GetRecurringRequestObject) (api.GetRecurringResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetRecurring401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	rule, err := s.recSvc.Get(ctx, p.LedgerID, req.Id)
	if errors.Is(err, recurring.ErrRuleNotFound) {
		return api.GetRecurring404JSONResponse(api.Error{Code: "not_found", Message: "recurring rule not found"}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.GetRecurring200JSONResponse(toAPIRecurringRule(rule)), nil
}

// UpdateRecurring updates a recurring rule.
func (s *ServerImpl) UpdateRecurring(ctx context.Context, req api.UpdateRecurringRequestObject) (api.UpdateRecurringResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.UpdateRecurring401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	active := true
	if req.Body.Active != nil {
		active = *req.Body.Active
	}
	rule, err := s.recSvc.Update(ctx, p.LedgerID, req.Id, req.Body.Rrule, fromAPITemplate(req.Body.Template), active)
	if errors.Is(err, recurring.ErrRuleNotFound) {
		return api.UpdateRecurring404JSONResponse(api.Error{Code: "not_found", Message: "recurring rule not found"}), nil
	}
	if code, msg, bad := recurringInputError(err); bad {
		return api.UpdateRecurring400JSONResponse(api.Error{Code: code, Message: msg}), nil
	}
	if err != nil {
		return nil, err
	}
	return api.UpdateRecurring200JSONResponse(toAPIRecurringRule(rule)), nil
}

// DeleteRecurring deletes a recurring rule (idempotent).
func (s *ServerImpl) DeleteRecurring(ctx context.Context, req api.DeleteRecurringRequestObject) (api.DeleteRecurringResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.DeleteRecurring401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	if err := s.recSvc.Delete(ctx, p.LedgerID, req.Id); err != nil {
		return nil, err
	}
	return api.DeleteRecurring204Response{}, nil
}

// TriggerRecurring triggers materialization of due recurring rules.
func (s *ServerImpl) TriggerRecurring(ctx context.Context, _ api.TriggerRecurringRequestObject) (api.TriggerRecurringResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.TriggerRecurring401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	// Scoped to the active book: a manual trigger must never post entries into
	// another tenant's ledger.
	count, err := s.recSvc.MaterializeDueForLedger(ctx, p.LedgerID)
	if err != nil {
		return nil, err
	}
	return api.TriggerRecurring200JSONResponse(api.RecurringTriggerResult{Count: count}), nil
}

// recurringInputError maps the recurring service's write-time rejections to a
// 400 code + a message that tells the user what to fix.
func recurringInputError(err error) (code, msg string, bad bool) {
	switch {
	case errors.Is(err, recurring.ErrUnbalancedTemplate):
		return "unbalanced_template", "debits and credits in the template must be equal", true
	case errors.Is(err, recurring.ErrAccountNotUsable):
		return "invalid_account", "a template line references an account that is missing, archived, or in a different currency", true
	case errors.Is(err, recurring.ErrInvalidInput):
		return "invalid_input", "invalid rrule or template: check format, currency, and line structure", true
	}
	return "", "", false
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

func toAPIBudget(b *budget.Budget) api.Budget {
	return api.Budget{
		Id:          b.ID,
		AccountId:   b.AccountID,
		PeriodMonth: openapi_types.Date{Time: b.PeriodMonth},
		TargetMinor: b.TargetMinor,
		Currency:    b.Currency,
		CreatedAt:   b.CreatedAt,
		UpdatedAt:   b.UpdatedAt,
	}
}

// toAPIChanges copies the internal ChangeSet into the generated map types.
func toAPIChanges(c syncpkg.ChangeSet) api.SyncChanges {
	out := api.SyncChanges{}
	for table, tc := range c {
		entry := api.SyncTableChanges{}
		if len(tc.Created) > 0 {
			cr := tc.Created
			entry.Created = &cr
		}
		if len(tc.Updated) > 0 {
			up := tc.Updated
			entry.Updated = &up
		}
		if len(tc.Deleted) > 0 {
			entry.Deleted = &tc.Deleted
		}
		out[table] = entry
	}
	return out
}

// toAPIRecurringRule maps a domain RecurringRule to the API model.
func toAPIRecurringRule(r *recurring.RecurringRule) api.RecurringRule {
	out := api.RecurringRule{
		Id:        r.ID,
		LedgerId:  r.LedgerID,
		Rrule:     r.RRule,
		Template:  toAPITemplate(r.Template),
		Active:    r.Active,
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
	if r.NextRun != nil {
		d := openapi_types.Date{Time: *r.NextRun}
		out.NextRun = &d
	}
	if r.LastRun != nil {
		d := openapi_types.Date{Time: *r.LastRun}
		out.LastRun = &d
	}
	out.LastError = r.LastError
	out.LastErrorAt = r.LastErrorAt
	return out
}

// toAPITemplate maps a domain Template to the API model.
func toAPITemplate(t recurring.Template) api.RecurringTemplate {
	lines := make([]api.RecurringLineTemplate, 0, len(t.Lines))
	for _, ln := range t.Lines {
		line := api.RecurringLineTemplate{
			AccountId:   ln.AccountID,
			Dc:          api.RecurringLineTemplateDc(ln.DC),
			AmountMinor: ln.AmountMinor,
		}
		if ln.Currency != "" {
			line.Currency = &ln.Currency
		}
		lines = append(lines, line)
	}
	out := api.RecurringTemplate{
		Currency: t.Currency,
		Lines:    lines,
	}
	if t.Memo != "" {
		out.Memo = &t.Memo
	}
	if t.Source != "" {
		out.Source = &t.Source
	}
	return out
}

// fromAPITemplate maps the API request template to the domain model.
func fromAPITemplate(t api.RecurringTemplate) recurring.Template {
	lines := make([]recurring.TemplateLine, 0, len(t.Lines))
	for _, ln := range t.Lines {
		line := recurring.TemplateLine{
			AccountID:   ln.AccountId,
			DC:          string(ln.Dc),
			AmountMinor: ln.AmountMinor,
		}
		if ln.Currency != nil {
			line.Currency = *ln.Currency
		}
		lines = append(lines, line)
	}
	out := recurring.Template{
		Currency: t.Currency,
		Lines:    lines,
		Source:   "recurring",
	}
	if t.Memo != nil {
		out.Memo = *t.Memo
	}
	return out
}

// fromAPIChanges copies the generated request ChangeSet into the internal type.
func fromAPIChanges(c api.SyncChanges) syncpkg.ChangeSet {
	out := syncpkg.ChangeSet{}
	for table, tc := range c {
		entry := syncpkg.TableChanges{}
		if tc.Created != nil {
			entry.Created = *tc.Created
		}
		if tc.Updated != nil {
			entry.Updated = *tc.Updated
		}
		if tc.Deleted != nil {
			entry.Deleted = *tc.Deleted
		}
		out[table] = entry
	}
	return out
}
