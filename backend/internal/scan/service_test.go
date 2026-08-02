package scan

import (
	"errors"
	"testing"
	"time"
)

// toDraft is where an untrusted model response becomes a number the user is
// about to confirm into their ledger, so it carries the whole money path: unit
// conversion, currency fallback, and the confidence gate on category proposals.
// These run without a database.
func TestToDraft(t *testing.T) {
	categories := []CategoryOption{
		{ID: "acc-food", Name: "Food"},
		{ID: "acc-transport", Name: "Transport"},
	}

	t.Run("converts to the currency's minor units", func(t *testing.T) {
		// IDR has no minor unit: 45000 rupiah is 45000 minor, not 4500000.
		d, err := toDraft(&Extraction{Currency: "IDR", Total: "45000", Confidence: 0.9}, nil, "IDR")
		if err != nil {
			t.Fatalf("toDraft: %v", err)
		}
		if d.AmountMinor != 45000 {
			t.Errorf("IDR 45000 = %d minor, want 45000", d.AmountMinor)
		}

		// USD has two: 12.34 dollars is 1234 cents.
		d, err = toDraft(&Extraction{Currency: "USD", Total: "12.34", Confidence: 0.9}, nil, "IDR")
		if err != nil {
			t.Fatalf("toDraft: %v", err)
		}
		if d.AmountMinor != 1234 {
			t.Errorf("USD 12.34 = %d minor, want 1234", d.AmountMinor)
		}
	})

	t.Run("falls back to the ledger currency when the receipt does not say", func(t *testing.T) {
		for _, bad := range []string{"", "rupiah", "Rp", "XXXX"} {
			d, err := toDraft(&Extraction{Currency: bad, Total: "1000", Confidence: 0.9}, nil, "IDR")
			if err != nil {
				t.Fatalf("currency %q: %v", bad, err)
			}
			if d.Currency != "IDR" {
				t.Errorf("currency %q fell back to %q, want IDR", bad, d.Currency)
			}
		}
	})

	t.Run("rejects a receipt with no usable total", func(t *testing.T) {
		for _, bad := range []string{"", "0", "-5", "n/a", "45.000,-"} {
			if _, err := toDraft(&Extraction{Currency: "IDR", Total: bad, Confidence: 0.9}, nil, "IDR"); !errors.Is(err, ErrUnreadable) {
				t.Errorf("total %q: got %v, want ErrUnreadable", bad, err)
			}
		}
	})

	t.Run("a low-confidence draft never carries a category", func(t *testing.T) {
		// The guard that matters: a confidently wrong category invites a
		// thoughtless confirm, an empty one makes the user choose.
		d, err := toDraft(&Extraction{
			Currency: "IDR", Total: "1000", CategoryID: "acc-food", Confidence: 0.3,
		}, categories, "IDR")
		if err != nil {
			t.Fatalf("toDraft: %v", err)
		}
		if d.CategoryID != nil {
			t.Errorf("category %q survived confidence 0.3, want nil", *d.CategoryID)
		}
	})

	t.Run("a category the ledger never offered is discarded", func(t *testing.T) {
		d, err := toDraft(&Extraction{
			Currency: "IDR", Total: "1000", CategoryID: "acc-invented", Confidence: 0.99,
		}, categories, "IDR")
		if err != nil {
			t.Fatalf("toDraft: %v", err)
		}
		if d.CategoryID != nil {
			t.Errorf("unknown category %q survived, want nil", *d.CategoryID)
		}
	})

	t.Run("keeps a confident category the ledger does offer", func(t *testing.T) {
		d, err := toDraft(&Extraction{
			Currency: "IDR", Total: "1000", CategoryID: "acc-transport", Confidence: 0.9,
		}, categories, "IDR")
		if err != nil {
			t.Fatalf("toDraft: %v", err)
		}
		if d.CategoryID == nil || *d.CategoryID != "acc-transport" {
			t.Errorf("category = %v, want acc-transport", d.CategoryID)
		}
	})

	t.Run("clamps confidence into 0..1", func(t *testing.T) {
		for _, tc := range []struct{ in, want float64 }{{-2, 0}, {7, 1}, {0.5, 0.5}} {
			d, err := toDraft(&Extraction{Currency: "IDR", Total: "1000", Confidence: tc.in}, nil, "IDR")
			if err != nil {
				t.Fatalf("toDraft: %v", err)
			}
			if d.Confidence != tc.want {
				t.Errorf("confidence %v clamped to %v, want %v", tc.in, d.Confidence, tc.want)
			}
		}
	})

	t.Run("uses the receipt date when it parses, today when it does not", func(t *testing.T) {
		d, err := toDraft(&Extraction{Currency: "IDR", Total: "1000", TxnDate: "2026-03-14", Confidence: 0.9}, nil, "IDR")
		if err != nil {
			t.Fatalf("toDraft: %v", err)
		}
		if d.TxnDate.Format(time.DateOnly) != "2026-03-14" {
			t.Errorf("txn date = %v, want 2026-03-14", d.TxnDate)
		}

		d, err = toDraft(&Extraction{Currency: "IDR", Total: "1000", TxnDate: "14/03/26", Confidence: 0.9}, nil, "IDR")
		if err != nil {
			t.Fatalf("toDraft: %v", err)
		}
		if got, want := d.TxnDate.Format(time.DateOnly), time.Now().Format(time.DateOnly); got != want {
			t.Errorf("unparseable date became %v, want today (%v)", got, want)
		}
	})
}

// truncate must cut on rune boundaries: merchant names are routinely non-ASCII
// and a byte slice would store a broken rune.
func TestTruncateIsRuneSafe(t *testing.T) {
	got := truncate("héllo wörld", 5)
	if got != "héllo" {
		t.Errorf("truncate = %q, want %q", got, "héllo")
	}
	if truncate("short", 99) != "short" {
		t.Error("truncate shortened a string already under the cap")
	}
}
