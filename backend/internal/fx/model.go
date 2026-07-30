// Package fx owns FX rate fetching (daily from frankfurter.app), storage, and
// as-of lookup. The fx_rates table is the server's single source of truth for
// cross-currency conversions in reports; rates are fetched daily and cached.
package fx

import "time"

// FxRate is one day's rate for a (base, quote) pair: 1 base = rate quote.
type FxRate struct {
	Base   string    // ISO 4217, e.g. "USD"
	Quote  string    // ISO 4217, e.g. "IDR"
	Day    time.Time // date of the rate
	Rate   string    // numeric as decimal string (e.g. "15000.00")
	Source string    // e.g. "frankfurter"
}

// FrankfurterResponse is the JSON shape returned by frankfurter.app.
type FrankfurterResponse struct {
	Amount float64            `json:"amount"`
	Base   string             `json:"base"`
	Date   string             `json:"date"`
	Rates  map[string]float64 `json:"rates"`
}
