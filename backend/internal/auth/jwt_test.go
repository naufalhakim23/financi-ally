package auth

import (
	"testing"
	"time"
)

func TestJWTRoundtrip(t *testing.T) {
	j := NewJWTService("test-secret", time.Minute)
	tok, _, err := j.Issue("uid-1", "a@b.com")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	c, err := j.Verify(tok)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if c.UserID != "uid-1" || c.Email != "a@b.com" {
		t.Fatalf("claims mismatch: %+v", c)
	}
}

func TestJWTRejectsBad(t *testing.T) {
	j := NewJWTService("test-secret", time.Minute)
	if _, err := j.Verify("garbage"); err == nil {
		t.Fatal("expected error verifying garbage")
	}
	// A token signed with a different secret must not verify.
	other := NewJWTService("other-secret", time.Minute)
	tok, _, _ := j.Issue("u", "e")
	if _, err := other.Verify(tok); err == nil {
		t.Fatal("expected error verifying token signed by another secret")
	}
}

func TestJWTExpired(t *testing.T) {
	// Negative TTL mints a token already in the past — verifies as expired.
	j := NewJWTService("s", -time.Minute)
	tok, _, _ := j.Issue("u", "e")
	if _, err := j.Verify(tok); err != ErrExpiredToken {
		t.Fatalf("expected ErrExpiredToken, got %v", err)
	}
}
