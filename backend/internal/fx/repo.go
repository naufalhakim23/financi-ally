package fx

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repo is the persistence boundary for FX rates.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo wires the repo to a pgx pool.
func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

const colFxRate = "base, quote, day, rate, source"

func scanFxRate(row pgx.Row) (*FxRate, error) {
	f := &FxRate{}
	if err := row.Scan(&f.Base, &f.Quote, &f.Day, &f.Rate, &f.Source); err != nil {
		return nil, err
	}
	return f, nil
}

// Upsert inserts or updates a rate for a (base, quote, day) triple. ON CONFLICT
// updates rate and source so a re-fetch on the same day bumps the value.
func (r *Repo) Upsert(ctx context.Context, f *FxRate) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO fx_rates (base, quote, day, rate, source)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (base, quote, day) DO UPDATE
		  SET rate = EXCLUDED.rate, source = EXCLUDED.source`,
		f.Base, f.Quote, f.Day, f.Rate, f.Source)
	if err != nil {
		return fmt.Errorf("upsert fx_rate %s/%s %s: %w", f.Base, f.Quote, f.Day.Format("2006-01-02"), err)
	}
	return nil
}

// Rate returns the rate for (base, quote) on or before asOf, preferring the
// exact day and falling back to the most recent <= asOf.
func (r *Repo) Rate(ctx context.Context, base, quote string, asOf time.Time) (*FxRate, error) {
	f, err := scanFxRate(r.db.QueryRow(ctx, `
		SELECT `+colFxRate+` FROM fx_rates
		WHERE base = $1 AND quote = $2 AND day <= $3
		ORDER BY day DESC LIMIT 1`, base, quote, asOf))
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get fx_rate %s/%s: %w", base, quote, err)
	}
	return f, nil
}

// LatestDay returns the most recent date for which rates exist for the given
// base currency. Returns zero time when no rates exist.
func (r *Repo) LatestDay(ctx context.Context, base string) (time.Time, error) {
	var day *time.Time
	err := r.db.QueryRow(ctx,
		`SELECT MAX(day) FROM fx_rates WHERE base = $1`, base).Scan(&day)
	if err != nil {
		return time.Time{}, fmt.Errorf("latest fx day: %w", err)
	}
	if day == nil {
		return time.Time{}, nil
	}
	return *day, nil
}

// BaseCurrencies returns the distinct base currencies that have rates loaded.
func (r *Repo) BaseCurrencies(ctx context.Context) ([]string, error) {
	rows, err := r.db.Query(ctx, `SELECT DISTINCT base FROM fx_rates ORDER BY base`)
	if err != nil {
		return nil, fmt.Errorf("base currencies: %w", err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var b string
		if err := rows.Scan(&b); err != nil {
			return nil, fmt.Errorf("scan base currency: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// DayRates returns all rates for a given base on a given day.
func (r *Repo) DayRates(ctx context.Context, base string, day time.Time) ([]*FxRate, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+colFxRate+` FROM fx_rates WHERE base = $1 AND day = $2 ORDER BY quote`, base, day)
	if err != nil {
		return nil, fmt.Errorf("day rates: %w", err)
	}
	defer rows.Close()
	var out []*FxRate
	for rows.Next() {
		f, err := scanFxRate(rows)
		if err != nil {
			return nil, fmt.Errorf("scan fx_rate: %w", err)
		}
		out = append(out, f)
	}
	return out, rows.Err()
}
