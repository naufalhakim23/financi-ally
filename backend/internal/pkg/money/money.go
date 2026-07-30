// Package money is the only allowed arithmetic surface for monetary amounts.
// Amounts are integer minor units (BIGINT cents) with a per-currency decimal
// scale; float never touches a money value. The scale table encodes how many
// decimal places a currency uses for input/display (IDR/JPY = 0, USD = 2,
// KWD = 3); ToMinor/Format convert between human decimal strings and int64
// minor units at that scale. Convert converts amounts between currencies at a
// given rate (stored as numeric in fx_rates).
package money

import (
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
)

// ErrInvalidAmount is returned when a decimal string is malformed, negative,
// or carries more fractional digits than the currency's scale allows.
var ErrInvalidAmount = errors.New("invalid amount")

// scaleByCurrency maps ISO 4217 codes to the minor-unit decimal places the app
// uses for input and display. The lists below are the exceptions; everything
// not listed defaults to 2 (the ISO 4217 majority).
//
// IDR is pinned to 0: although ISO formally assigns 2 (sen), sen is unused in
// practice and no real-world entry uses it. For a personal-finance app whose
// primary currency is rupiah, 0 is the honest scale. Same reasoning for the
// other 0-decimal currencies. Add a currency here only if its practical scale
// differs from 2.
var (
	scale0 = map[string]bool{ // no minor unit
		"IDR": true, "JPY": true, "KRW": true, "VND": true, "CLP": true,
		"ISK": true, "UGX": true, "PYG": true, "RWF": true, "VUV": true, "XAF": true, "XOF": true, "XPF": true,
	}
	scale3 = map[string]bool{ // 3 minor units
		"KWD": true, "BHD": true, "OMR": true, "JOD": true, "TND": true, "IQD": true, "LYD": true,
	}
)

// Scale returns the minor-unit decimal places for an ISO 4217 currency code.
// Unknown codes default to 2 (the ISO majority); this is a safe fallback, not a
// guess — a code not in the exception lists is almost certainly 2-decimal.
func Scale(currency string) int {
	switch {
	case scale0[currency]:
		return 0
	case scale3[currency]:
		return 3
	default:
		return 2
	}
}

// IsAlpha3 reports whether s is exactly 3 ASCII letters (A–Z). Used to validate
// ISO 4217 currency codes after ToUpper so "123" or "US1" can't slip through a
// length-only check.
func IsAlpha3(s string) bool {
	if len(s) != 3 {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < 'A' || s[i] > 'Z' {
			return false
		}
	}
	return true
}

// ToMinor converts a human decimal amount (e.g. "50000", "50.00", "50.5") to
// integer minor units at the currency's scale. Leading/trailing whitespace is
// trimmed. Rejects negatives, empty strings, multiple separators, and fractional
// digits beyond the scale (e.g. "50.001" for USD is an error).
func ToMinor(currency, amount string) (int64, error) {
	scale := Scale(currency)
	raw := strings.TrimSpace(amount)
	if raw == "" {
		return 0, fmt.Errorf("%w: empty amount", ErrInvalidAmount)
	}
	if strings.ContainsAny(raw, "-+") {
		return 0, fmt.Errorf("%w: amount must be non-negative", ErrInvalidAmount)
	}

	intPart, fracPart, hasDot := strings.Cut(raw, ".")
	if hasDot && strings.Contains(fracPart, ".") {
		return 0, fmt.Errorf("%w: multiple decimal points", ErrInvalidAmount)
	}
	if intPart == "" && fracPart == "" {
		return 0, fmt.Errorf("%w: empty amount", ErrInvalidAmount)
	}
	if intPart == "" {
		intPart = "0"
	}
	if fracPart == "" && !hasDot {
		fracPart = ""
	} else if len(fracPart) > scale {
		return 0, fmt.Errorf("%w: %q has more fractional digits than %s scale %d", ErrInvalidAmount, amount, currency, scale)
	}
	if !allDigits(intPart) || (fracPart != "" && !allDigits(fracPart)) {
		return 0, fmt.Errorf("%w: non-numeric amount %q", ErrInvalidAmount, amount)
	}

	intVal, err := strconv.ParseInt(intPart, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("%w: integer part overflow", ErrInvalidAmount)
	}
	// Pad/truncate fracPart to the scale and parse.
	frac := fracPart
	if scale > 0 {
		frac = (frac + strings.Repeat("0", scale))[:scale]
	}
	var fracVal int64
	if scale > 0 {
		fracVal, err = strconv.ParseInt(frac, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("%w: fractional part overflow", ErrInvalidAmount)
		}
	}

	total := intVal
	for i := 0; i < scale; i++ {
		total *= 10
	}
	total += fracVal
	if total < 0 {
		return 0, fmt.Errorf("%w: overflow", ErrInvalidAmount)
	}
	return total, nil
}

// Format converts integer minor units to a human decimal string at the
// currency's scale (e.g. minor 50000, IDR → "50000"; minor 5000, USD → "50.00").
func Format(currency string, minor int64) string {
	scale := Scale(currency)
	neg := minor < 0
	if neg {
		minor = -minor
	}
	s := strconv.FormatInt(minor, 10)
	if scale == 0 {
		if neg {
			return "-" + s
		}
		return s
	}
	// Left-pad so we can split int/frac at the scale boundary.
	if len(s) <= scale {
		s = strings.Repeat("0", scale-len(s)+1) + s
	}
	intPart := s[:len(s)-scale]
	fracPart := s[len(s)-scale:]
	out := intPart + "." + fracPart
	if neg {
		out = "-" + out
	}
	return out
}

// Convert converts an amount in minor units from one currency to another using
// the given rate (1 unit of from = rate units of to). The rate is already at
// the minor-unit scale, so this is simply: minor * rate, rounded half-up.
// Example: Convert(50000, "IDR", "USD", "0.00006667") → 3 USD cents ($0.03).
func Convert(minor int64, from, to, rate string) (int64, error) {
	if !IsAlpha3(from) || !IsAlpha3(to) {
		return 0, fmt.Errorf("%w: invalid currency code", ErrInvalidAmount)
	}
	r, ok := new(big.Rat).SetString(rate)
	if !ok || r.Sign() <= 0 {
		return 0, fmt.Errorf("%w: invalid or non-positive rate %q", ErrInvalidAmount, rate)
	}
	if minor == 0 {
		return 0, nil
	}
	amt := new(big.Rat).SetInt64(minor)
	converted := new(big.Rat).Mul(amt, r)
	if converted.Denom().Cmp(big.NewInt(1)) == 0 {
		return converted.Num().Int64(), nil
	}
	num := new(big.Int).Div(converted.Num(), converted.Denom())
	rem := new(big.Int).Rem(converted.Num(), converted.Denom())
	if rem.Sign() > 0 {
		half := new(big.Int).Quo(converted.Denom(), big.NewInt(2))
		if rem.Cmp(half) >= 0 {
			num.Add(num, big.NewInt(1))
		}
	}
	if !num.IsInt64() {
		return 0, fmt.Errorf("%w: conversion overflow", ErrInvalidAmount)
	}
	return num.Int64(), nil
}

func allDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}
