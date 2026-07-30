package money

import "testing"

func TestScale(t *testing.T) {
	cases := map[string]int{
		"IDR": 0, "JPY": 0, "KRW": 0, "VND": 0,
		"USD": 2, "EUR": 2, "GBP": 2, "SGD": 2,
		"KWD": 3, "BHD": 3, "OMR": 3,
		"XXX": 2, // unknown defaults to 2
	}
	for cur, want := range cases {
		if got := Scale(cur); got != want {
			t.Errorf("Scale(%q) = %d, want %d", cur, got, want)
		}
	}
}

func TestIsAlpha3(t *testing.T) {
	good := []string{"IDR", "USD", "EUR", "AAA"}
	bad := []string{"", "US", "USDA", "123", "us1", "us", "U1A"}
	for _, s := range good {
		if !IsAlpha3(s) {
			t.Errorf("IsAlpha3(%q) = false, want true", s)
		}
	}
	for _, s := range bad {
		if IsAlpha3(s) {
			t.Errorf("IsAlpha3(%q) = true, want false", s)
		}
	}
}

func TestToMinor(t *testing.T) {
	cases := []struct {
		cur, amt string
		want     int64
	}{
		{"IDR", "50000", 50000},
		{"IDR", "  50000  ", 50000},
		{"USD", "50.00", 5000},
		{"USD", "50", 5000},   // implied decimals
		{"USD", "50.5", 5050}, // pad to 2
		{"USD", "0.99", 99},
		{"USD", ".5", 50},     // bare fraction
		{"USD", "0", 0},
		{"KWD", "1.234", 1234}, // scale 3
		{"JPY", "5000", 5000},
	}
	for _, c := range cases {
		got, err := ToMinor(c.cur, c.amt)
		if err != nil {
			t.Errorf("ToMinor(%q,%q) err = %v, want nil", c.cur, c.amt, err)
			continue
		}
		if got != c.want {
			t.Errorf("ToMinor(%q,%q) = %d, want %d", c.cur, c.amt, got, c.want)
		}
	}
}

func TestToMinorErrors(t *testing.T) {
	bad := []struct{ cur, amt string }{
		{"USD", ""},          // empty
		{"USD", "-5"},        // negative
		{"USD", "50.001"},    // too many decimals
		{"IDR", "50000.00"},  // IDR scale 0, fractional rejected
		{"USD", "5.0.0"},     // multiple dots
		{"USD", "abc"},       // non-numeric
		{"USD", "5a"},        // non-numeric
	}
	for _, c := range bad {
		if _, err := ToMinor(c.cur, c.amt); err == nil {
			t.Errorf("ToMinor(%q,%q) = nil err, want error", c.cur, c.amt)
		}
	}
}

func TestFormat(t *testing.T) {
	cases := []struct {
		cur   string
		minor int64
		want  string
	}{
		{"IDR", 50000, "50000"},
		{"USD", 5000, "50.00"},
		{"USD", 5050, "50.50"},
		{"USD", 99, "0.99"},
		{"USD", 0, "0.00"},
		{"KWD", 1234, "1.234"},
		{"JPY", 5000, "5000"},
		{"USD", -5000, "-50.00"},
	}
	for _, c := range cases {
		if got := Format(c.cur, c.minor); got != c.want {
			t.Errorf("Format(%q,%d) = %q, want %q", c.cur, c.minor, got, c.want)
		}
	}
}

func TestConvert(t *testing.T) {
	cases := []struct {
		minor    int64
		from, to string
		rate     string
		want     int64
	}{
		{50000, "IDR", "IDR", "1", 50000},            // same currency, rate 1
		{10000, "USD", "IDR", "15000", 150000000},     // 1 USD = 15000 IDR
		{150000000, "IDR", "USD", "0.00006667", 10001}, // ~150jt IDR → $100.01 USD (rounded up)
		{0, "USD", "IDR", "15000", 0},                 // zero amount
		{500, "USD", "EUR", "0.92", 460},              // 500 USD cents = 460 EUR cents
		{3334, "USD", "IDR", "15000", 50010000},       // $33.34 → IDR at 15000
	}
	for _, c := range cases {
		got, err := Convert(c.minor, c.from, c.to, c.rate)
		if err != nil {
			t.Errorf("Convert(%d,%q,%q,%q) err = %v", c.minor, c.from, c.to, c.rate, err)
			continue
		}
		if got != c.want {
			t.Errorf("Convert(%d,%q,%q,%q) = %d, want %d", c.minor, c.from, c.to, c.rate, got, c.want)
		}
	}
}

func TestConvertRejects(t *testing.T) {
	bad := []struct{ minor int64; from, to, rate string }{
		{100, "US1", "IDR", "15000"}, // invalid from currency
		{100, "USD", "INVALID", "1"}, // invalid to currency
		{100, "USD", "IDR", "0"},     // non-positive rate
		{100, "USD", "IDR", "-5"},    // negative rate
	}
	for _, c := range bad {
		if _, err := Convert(c.minor, c.from, c.to, c.rate); err == nil {
			t.Errorf("Convert(%d,%q,%q,%q) = nil err, want error", c.minor, c.from, c.to, c.rate)
		}
	}
}

// Round-trip: ToMinor ∘ Format should be stable at the currency's scale.
func TestRoundTrip(t *testing.T) {
	for _, cur := range []string{"IDR", "USD", "JPY", "KWD", "EUR"} {
		for _, minor := range []int64{0, 1, 99, 5000, 50000, 999999} {
			formatted := Format(cur, minor)
			got, err := ToMinor(cur, formatted)
			if err != nil {
				t.Fatalf("roundtrip %s %d→%q: %v", cur, minor, formatted, err)
			}
			if got != minor {
				t.Errorf("roundtrip %s: %d → %q → %d", cur, minor, formatted, got)
			}
		}
	}
}
