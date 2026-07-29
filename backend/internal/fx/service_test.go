package fx

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/naufalhakim23/financi-ally/backend/internal/db"
)

func newTestRepo(t *testing.T) *Repo {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL unset; skipping fx integration test")
	}
	if err := db.Migrate(dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(), `TRUNCATE TABLE fx_rates`); err != nil {
		t.Fatalf("truncate fx_rates: %v", err)
	}
	return NewRepo(pool)
}

func TestUpsertAndRate(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()
	day := time.Date(2026, 7, 28, 0, 0, 0, 0, time.UTC)

	if err := repo.Upsert(ctx, &FxRate{
		Base: "USD", Quote: "IDR", Day: day, Rate: "15000", Source: "frankfurter",
	}); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	f, err := repo.Rate(ctx, "USD", "IDR", day)
	if err != nil {
		t.Fatalf("rate: %v", err)
	}
	if f == nil || f.Rate != "15000" {
		t.Fatalf("got rate %+v, want 15000", f)
	}

	// Fallback: query a day without exact match.
	future := day.Add(24 * time.Hour)
	f, err = repo.Rate(ctx, "USD", "IDR", future)
	if err != nil {
		t.Fatalf("rate fallback: %v", err)
	}
	if f == nil || f.Rate != "15000" {
		t.Fatalf("got rate %+v, want 15000 (fallback)", f)
	}
}

func TestLatestDay(t *testing.T) {
	repo := newTestRepo(t)
	ctx := context.Background()
	day := time.Date(2026, 7, 28, 0, 0, 0, 0, time.UTC)

	latest, err := repo.LatestDay(ctx, "USD")
	if err != nil {
		t.Fatalf("latest day empty: %v", err)
	}
	if !latest.IsZero() {
		t.Fatalf("expected zero, got %v", latest)
	}

	if err := repo.Upsert(ctx, &FxRate{Base: "USD", Quote: "IDR", Day: day, Rate: "15000", Source: "frankfurter"}); err != nil {
		t.Fatalf("upsert: %v", err)
	}
	latest, err = repo.LatestDay(ctx, "USD")
	if err != nil {
		t.Fatalf("latest day: %v", err)
	}
	if latest.IsZero() {
		t.Fatal("expected non-zero day")
	}
}
