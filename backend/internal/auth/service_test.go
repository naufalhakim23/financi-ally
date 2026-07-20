package auth

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/naufalhakim23/financi-ally/backend/internal/db"
)

// newTestService builds a Service against a real Postgres. Skipped when
// DATABASE_URL is unset, so `go test ./...` still passes without a DB.
// Migrations are applied (idempotent) and the auth tables truncated for a
// clean slate, making the test re-runnable.
func newTestService(t *testing.T) (*Service, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL unset; skipping auth integration test")
	}
	if err := db.Migrate(dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	for _, tbl := range []string{"oauth_identities", "refresh_tokens", "users"} {
		if _, err := pool.Exec(context.Background(), "TRUNCATE TABLE "+tbl+" RESTART IDENTITY CASCADE"); err != nil {
			t.Fatalf("truncate %s: %v", tbl, err)
		}
	}
	repo := NewRepo(pool)
	jwt := NewJWTService("test-secret", time.Minute)
	svc := NewService(repo, jwt, NewGoogle("", ""), time.Hour, "IDR")
	return svc, func() { pool.Close() }
}

func TestRegisterLoginRefreshLogout(t *testing.T) {
	svc, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()

	sess, err := svc.Register(ctx, "alice@example.com", "password123", "")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if sess.AccessToken == "" || sess.RefreshToken == "" || sess.User == nil {
		t.Fatal("incomplete session")
	}
	if sess.User.BaseCurrency != "IDR" {
		t.Fatalf("base currency default = %q, want IDR", sess.User.BaseCurrency)
	}

	// Duplicate email → ErrEmailExists.
	if _, err := svc.Register(ctx, "alice@example.com", "password123", ""); !errors.Is(err, ErrEmailExists) {
		t.Fatalf("duplicate register: want ErrEmailExists, got %v", err)
	}

	// Wrong password and unknown user both → ErrInvalidCredentials (no leak).
	if _, err := svc.Login(ctx, "alice@example.com", "wrong"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("bad password: want ErrInvalidCredentials, got %v", err)
	}
	if _, err := svc.Login(ctx, "ghost@example.com", "x"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("unknown user: want ErrInvalidCredentials, got %v", err)
	}

	// Good login.
	sess2, err := svc.Login(ctx, "alice@example.com", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}

	// Me.
	u, err := svc.Me(ctx, sess2.User.ID)
	if err != nil || u.Email != "alice@example.com" {
		t.Fatalf("me: err=%v user=%+v", err, u)
	}

	// Refresh rotation: new session issued, old token dead on replay.
	sess3, err := svc.Refresh(ctx, sess2.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if _, err := svc.Refresh(ctx, sess2.RefreshToken); !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("replay: want ErrInvalidToken, got %v", err)
	}
	// The freshly rotated token still works.
	if _, err := svc.Refresh(ctx, sess3.RefreshToken); err != nil {
		t.Fatalf("refresh rotated token: %v", err)
	}

	// Logout is idempotent.
	if err := svc.Logout(ctx, sess.User.ID, sess3.RefreshToken); err != nil {
		t.Fatalf("logout: %v", err)
	}
}
