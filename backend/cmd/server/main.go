package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/budget"
	"github.com/naufalhakim23/financi-ally/backend/internal/config"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
	"github.com/naufalhakim23/financi-ally/backend/internal/fx"
	"github.com/naufalhakim23/financi-ally/backend/internal/handler"
	"github.com/naufalhakim23/financi-ally/backend/internal/household"
	"github.com/naufalhakim23/financi-ally/backend/internal/ledger"
	"github.com/naufalhakim23/financi-ally/backend/internal/mail"
	"github.com/naufalhakim23/financi-ally/backend/internal/recurring"
	"github.com/naufalhakim23/financi-ally/backend/internal/reporting"
	syncpkg "github.com/naufalhakim23/financi-ally/backend/internal/sync"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, nil)))

	if err := godotenv.Load(); err != nil {
		slog.Warn("no .env file found, using environment variables")
	}

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "err", err)
		os.Exit(1)
	}

	pool, err := db.New(&db.Config{
		URL:          cfg.Database.URL,
		MaxOpenConns: cfg.Database.MaxOpenConns,
		MaxIdleConns: cfg.Database.MaxIdleConns,
		ConnMaxIdle:  cfg.Database.ConnMaxIdle,
		ConnMaxLife:  cfg.Database.ConnMaxLife,
	})
	if err != nil {
		slog.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("database connected")

	// Migrate on boot: fail-closed; a backend that can't reach schema parity
	// is worse than one that refuses to start.
	if err := db.Migrate(cfg.Database.URL); err != nil {
		slog.Error("failed to apply migrations", "err", err)
		os.Exit(1)
	}
	slog.Info("migrations applied")

	// Auth wiring: repo → password/jwt/google primitives → service → handler.
	repo := auth.NewRepo(pool.Pool)
	jwtSvc := auth.NewJWTService(cfg.Auth.JWTSecret, cfg.Auth.AccessTokenTTL)
	googleSvc := auth.NewGoogle(cfg.Google.ClientID, cfg.Google.ClientSecret)
	mailSvc := mail.New(mail.Config{APIKey: cfg.Mail.APIKey, From: cfg.Mail.From, Mock: cfg.Mail.Mock})
	svc := auth.NewService(repo, jwtSvc, googleSvc, mailSvc, cfg.Auth.RefreshTokenTTL, cfg.Auth.BaseCurrencyDefault)

	// Ledger wiring: repo → service → handler.
	ledgerRepo := ledger.NewRepo(pool.Pool)
	ledgerSvc := ledger.NewService(ledgerRepo)

	// Budget + sync wiring. Budget validates against the ledger; sync reuses
	// ledger.Post and budget.Set so pushed records can't bypass validation.
	budgetSvc := budget.NewService(budget.NewRepo(pool.Pool), ledgerSvc)

	// FX wiring: repo → service.
	fxRepo := fx.NewRepo(pool.Pool)
	fxSvc := fx.NewService(fxRepo)

	// Reporting wiring: repo → service (depends on FX for normalization).
	reportRepo := reporting.NewRepo(pool.Pool)
	reportSvc := reporting.NewService(reportRepo, fxSvc)

	// Recurring wiring: repo → service (depends on ledger for posting entries).
	recRepo := recurring.NewRepo(pool.Pool)
	recSvc := recurring.NewService(recRepo, ledgerSvc, cfg.Recurring.Location)

	// Sync reuses ledger.Post, budget.Set and the recurring service so pushed
	// records can't bypass the validation the REST path enforces.
	syncSvc := syncpkg.NewService(syncpkg.NewRepo(pool.Pool), ledgerSvc, budgetSvc, recSvc)

	// Household wiring: ledgers, membership and join codes. Also the middleware
	// dependency that turns an authenticated user into an active ledger.
	householdSvc := household.NewService(household.NewRepo(pool.Pool))

	serverImpl := handler.NewServerImpl(pool, svc, ledgerSvc, budgetSvc, syncSvc, fxSvc, reportSvc, recSvc, householdSvc)

	// Strict-server error handlers emit our JSON Error shape instead of plain
	// text, and never leak internal error strings to clients.
	opts := api.StrictHTTPServerOptions{
		RequestErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, _ error) {
			writeStrictError(w, http.StatusBadRequest, "bad_request", "malformed request body")
		},
		ResponseErrorHandlerFunc: func(w http.ResponseWriter, _ *http.Request, err error) {
			slog.Error("unhandled error", "err", err)
			writeStrictError(w, http.StatusInternalServerError, "internal_error", "internal server error")
		},
	}
	// The browser client's refresh token lives in an httpOnly cookie rather than
	// localStorage; see internal/handler/cookie_auth.go. Mobile is unaffected
	// either way, so this stays off unless a web deploy asks for it.
	var strictMW []api.StrictMiddlewareFunc
	if cfg.Auth.WebCookieAuth {
		strictMW = append(strictMW, handler.WebCookieAuth(cfg.Auth.WebCookieSecure, cfg.Auth.WebCookiePath))
	}
	strict := api.NewStrictHandlerWithOptions(serverImpl, strictMW, opts)

	// Spec-derived request validation + bearer security (replaces the M1 path
	// allowlist once ledger grew the protected surface past a handful).
	validator, err := handler.SpecValidator()
	if err != nil {
		slog.Error("build spec validator", "err", err)
		os.Exit(1)
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(handler.AuthInject(jwtSvc))        // verify + inject principal (best-effort, all routes)
	r.Use(handler.LedgerScope(householdSvc)) // resolve the active book onto the principal
	r.Use(validator)                         // schema validation + enforce bearerAuth on protected routes
	r.Mount("/", api.Handler(strict))

	srv := &http.Server{
		Addr:              ":" + cfg.Server.Port,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second, // cheap Slowloris guard
	}

	go func() {
		slog.Info("server starting", "port", cfg.Server.Port, "env", cfg.Server.Environment,
			"google_enabled", googleSvc.Enabled())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("failed to start server", "err", err)
			os.Exit(1)
		}
	}()

	// Recurring scheduler: sweep due rules on an interval and materialize their
	// entries. Runs in a background goroutine so it doesn't block shutdown.
	// Posting is idempotent per (rule, occurrence date), so an extra sweep — or
	// a second replica running its own — can't double-post.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if cfg.Recurring.Enabled {
		go func() {
			slog.Info("recurring scheduler started",
				"interval", cfg.Recurring.Interval, "tz", cfg.Recurring.Location.String())
			ticker := time.NewTicker(cfg.Recurring.Interval)
			defer ticker.Stop()
			// Run once on startup to catch rules due during downtime.
			materializeDue(ctx, recSvc)
			for {
				select {
				case <-ticker.C:
					materializeDue(ctx, recSvc)
				case <-ctx.Done():
					slog.Info("recurring scheduler stopped")
					return
				}
			}
		}()
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// Cancel the background context first so the scheduler goroutine stops.
	cancel()

	slog.Info("shutting down server")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "err", err)
		os.Exit(1)
	}
	slog.Info("server exited")
}

// materializeDue wraps the recurring service's MaterializeDue with logging so
// the scheduler goroutine in main doesn't need to handle errors inline.
func materializeDue(ctx context.Context, recSvc *recurring.Service) {
	if _, err := recSvc.MaterializeDue(ctx); err != nil {
		slog.Error("recurring materialize", "err", err)
	}
}

// writeStrictError writes a JSON Error body for the strict-server fallback
// handlers (bad request body / unhandled 500). Kept in main because it's the
// only place these top-level fallbacks fire.
func writeStrictError(w http.ResponseWriter, code int, errCode, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_, _ = w.Write([]byte(`{"code":"` + errCode + `","message":"` + message + `"}`))
}
