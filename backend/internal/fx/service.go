package fx

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"time"
)

// frankfurterBase is the daily FX API (ECB-backed, free, no key).
const frankfurterBase = "https://api.frankfurter.app"

// Service orchestrates FX rate fetching and conversion. The daily refresh job
// calls RefreshDaily; reporting calls AtOrBefore for conversion.
type Service struct {
	repo   *Repo
	client *http.Client
}

// NewService wires the FX service.
func NewService(repo *Repo) *Service {
	return &Service{
		repo:   repo,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

// ErrNoRate is returned when no FX rate is available for the given pair.
var ErrNoRate = fmt.Errorf("no fx rate available")

// RefreshDaily fetches today's rates from frankfurter.app for the given base
// currencies (typically EUR, USD, IDR, etc.) and upserts them. Idempotent.
func (s *Service) RefreshDaily(ctx context.Context, baseCurrencies []string) error {
	today := time.Now().Truncate(24 * time.Hour)
	for _, base := range baseCurrencies {
		if err := s.refreshBase(ctx, base, today); err != nil {
			return fmt.Errorf("refresh %s: %w", base, err)
		}
	}
	return nil
}

func (s *Service) refreshBase(ctx context.Context, base string, day time.Time) error {
	url := fmt.Sprintf("%s/latest?from=%s", frankfurterBase, base)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("frankfurter %s: %s %s", url, resp.Status, string(body))
	}

	var fr FrankfurterResponse
	if err := json.NewDecoder(resp.Body).Decode(&fr); err != nil {
		return fmt.Errorf("decode frankfurter response: %w", err)
	}

	for quote, rate := range fr.Rates {
		if math.IsNaN(rate) || math.IsInf(rate, 0) || rate <= 0 {
			continue
		}
		// Store as a decimal string for precision.
		rateStr := fmt.Sprintf("%.10f", rate)
		if err := s.repo.Upsert(ctx, &FxRate{
			Base:   base,
			Quote:  quote,
			Day:    day,
			Rate:   rateStr,
			Source: "frankfurter",
		}); err != nil {
			return err
		}
	}
	// Also store 1:1 for base→base.
	if err := s.repo.Upsert(ctx, &FxRate{
		Base:   base,
		Quote:  base,
		Day:    day,
		Rate:   "1",
		Source: "frankfurter",
	}); err != nil {
		return err
	}
	return nil
}

// AtOrBefore returns the rate from the source currency to the target currency on
// or before the given date. Falls back to the inverse rate (target→source) when
// the direct pair is missing, and computes cross-rates via a bridge currency
// (EUR, then USD) if neither direct nor inverse is available.
func (s *Service) AtOrBefore(ctx context.Context, from, to string, asOf time.Time) (*FxRate, error) {
	if from == to {
		return &FxRate{Base: from, Quote: to, Day: asOf, Rate: "1", Source: "identity"}, nil
	}

	// Direct: from→to.
	f, err := s.repo.Rate(ctx, from, to, asOf)
	if err != nil {
		return nil, err
	}
	if f != nil {
		return f, nil
	}

	// Inverse: to→from, invert rate.
	f, err = s.repo.Rate(ctx, to, from, asOf)
	if err != nil {
		return nil, err
	}
	if f != nil {
		f.Base, f.Quote = from, to
		f.Rate = invertRate(f.Rate)
		f.Source = "inverse"
		return f, nil
	}

	// Cross via EUR (ECB base).
	f, err = s.crossRate(ctx, from, to, "EUR", asOf)
	if err != nil {
		return nil, err
	}
	if f != nil {
		return f, nil
	}

	// Cross via USD.
	f, err = s.crossRate(ctx, from, to, "USD", asOf)
	if err != nil {
		return nil, err
	}
	if f != nil {
		return f, nil
	}

	return nil, ErrNoRate
}

func (s *Service) crossRate(ctx context.Context, from, to, bridge string, asOf time.Time) (*FxRate, error) {
	fFrom, err := s.repo.Rate(ctx, bridge, from, asOf)
	if err != nil {
		return nil, err
	}
	fTo, err := s.repo.Rate(ctx, bridge, to, asOf)
	if err != nil {
		return nil, err
	}
	if fFrom == nil || fTo == nil {
		return nil, nil
	}
	// from→EUR: invert EUR→from. Then EUR→to.
	fromRate := invertRate(fFrom.Rate)
	rate := mulRates(fromRate, fTo.Rate)
	return &FxRate{
		Base:   from,
		Quote:  to,
		Day:    fTo.Day,
		Rate:   rate,
		Source: fmt.Sprintf("cross_%s", bridge),
	}, nil
}

// BaseCurrencies returns distinct base currencies that have rates loaded.
func (s *Service) BaseCurrencies(ctx context.Context) ([]string, error) {
	return s.repo.BaseCurrencies(ctx)
}

// LatestDay returns the most recent date with rates for the given base.
func (s *Service) LatestDay(ctx context.Context, base string) (time.Time, error) {
	return s.repo.LatestDay(ctx, base)
}

// DayRates returns all rates for a given base on a given day.
func (s *Service) DayRates(ctx context.Context, base string, day time.Time) ([]*FxRate, error) {
	return s.repo.DayRates(ctx, base, day)
}

// invertRate returns "1 / rate" as a decimal string.
func invertRate(r string) string {
	return fmt.Sprintf("1/%s", r)
}

// mulRates returns the product of two decimal rate strings.
func mulRates(a, b string) string {
	return fmt.Sprintf("(%s)*(%s)", a, b)
}
