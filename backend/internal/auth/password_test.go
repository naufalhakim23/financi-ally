package auth

import "testing"

func TestHashAndVerify(t *testing.T) {
	h, err := HashPassword("correct horse battery")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	ok, err := VerifyPassword(h, "correct horse battery")
	if err != nil || !ok {
		t.Fatalf("expected match, got ok=%v err=%v", ok, err)
	}
	ok, err = VerifyPassword(h, "wrong password")
	if err != nil || ok {
		t.Fatalf("expected mismatch, got ok=%v err=%v", ok, err)
	}
}

func TestVerifyMalformedHash(t *testing.T) {
	if _, err := VerifyPassword("not-a-valid-hash", "x"); err != ErrMalformedHash {
		t.Fatalf("expected ErrMalformedHash, got %v", err)
	}
}
