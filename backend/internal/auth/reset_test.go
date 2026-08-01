package auth

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"
)

// captureSender stands in for the mail provider so a test can read the code the
// user would have received. A channel, not a field: the service sends off the
// request path, so the test must wait for the send.
type captureSender struct{ sent chan string }

func newCaptureSender() *captureSender { return &captureSender{sent: make(chan string, 8)} }

func (c *captureSender) Send(_ context.Context, _, _, html string) error {
	c.sent <- html
	return nil
}

var codeRe = regexp.MustCompile(`\b(\d{6})\b`)

func (c *captureSender) code(t *testing.T) string {
	t.Helper()
	select {
	case html := <-c.sent:
		m := codeRe.FindStringSubmatch(html)
		if m == nil {
			t.Fatalf("no 6-digit code in email body: %q", html)
		}
		return m[1]
	case <-time.After(2 * time.Second):
		t.Fatal("no reset email was sent")
		return ""
	}
}

// quiet fails if an email arrives within a short grace period.
func (c *captureSender) quiet(t *testing.T, why string) {
	t.Helper()
	select {
	case html := <-c.sent:
		t.Fatalf("%s, but an email was sent: %q", why, html)
	case <-time.After(200 * time.Millisecond):
	}
}

// The whole reset contract in one pass: an unknown address is silent, a wrong
// code is refused, the right code works once, the old password stops working,
// and pre-reset refresh tokens are dead.
func TestPasswordReset(t *testing.T) {
	svc, cleanup := newTestService(t)
	defer cleanup()
	sender := newCaptureSender()
	svc.mail = sender
	ctx := context.Background()

	sess, err := svc.Register(ctx, "reset@example.com", "original-password", "IDR")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	// Unknown address: no error, and nothing sent.
	if err := svc.RequestPasswordReset(ctx, "nobody@example.com"); err != nil {
		t.Fatalf("forgot for unknown email should be silent, got %v", err)
	}
	sender.quiet(t, "the address is unregistered")

	if err := svc.RequestPasswordReset(ctx, "reset@example.com"); err != nil {
		t.Fatalf("forgot: %v", err)
	}
	code := sender.code(t)

	// Re-asking immediately is throttled: still no error (that would be an
	// oracle), but no second email and the first code stays live.
	if err := svc.RequestPasswordReset(ctx, "reset@example.com"); err != nil {
		t.Fatalf("throttled forgot should still be silent, got %v", err)
	}
	sender.quiet(t, "a code was issued moments ago")

	if _, err := svc.ResetPassword(ctx, "reset@example.com", "000000", "new-password-1"); !errors.Is(err, ErrInvalidResetCode) {
		t.Fatalf("wrong code should be ErrInvalidResetCode, got %v", err)
	}
	if _, err := svc.ResetPassword(ctx, "reset@example.com", code, "short"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("short password should be ErrInvalidInput, got %v", err)
	}

	if _, err := svc.ResetPassword(ctx, "reset@example.com", code, "new-password-1"); err != nil {
		t.Fatalf("reset with the right code: %v", err)
	}
	// Single use.
	if _, err := svc.ResetPassword(ctx, "reset@example.com", code, "new-password-2"); !errors.Is(err, ErrInvalidResetCode) {
		t.Fatalf("replayed code should be refused, got %v", err)
	}

	if _, err := svc.Login(ctx, "reset@example.com", "original-password"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatal("the old password still works after a reset")
	}
	if _, err := svc.Login(ctx, "reset@example.com", "new-password-1"); err != nil {
		t.Fatalf("login with the new password: %v", err)
	}
	// A reset is the remedy for a compromise; sessions from before it must die.
	if _, err := svc.Refresh(ctx, sess.RefreshToken); err == nil {
		t.Fatal("a refresh token issued before the reset still rotates")
	}
}

// Guessing is bounded: the request is burned once the ceiling is hit, so the
// correct code stops working too.
func TestPasswordResetAttemptCeiling(t *testing.T) {
	svc, cleanup := newTestService(t)
	defer cleanup()
	sender := newCaptureSender()
	svc.mail = sender
	ctx := context.Background()

	if _, err := svc.Register(ctx, "brute@example.com", "original-password", "IDR"); err != nil {
		t.Fatalf("register: %v", err)
	}
	if err := svc.RequestPasswordReset(ctx, "brute@example.com"); err != nil {
		t.Fatalf("forgot: %v", err)
	}
	code := sender.code(t)

	wrong := "000000"
	if wrong == code {
		wrong = "111111"
	}
	for i := 0; i < resetMaxAttempts; i++ {
		if _, err := svc.ResetPassword(ctx, "brute@example.com", wrong, "new-password-1"); !errors.Is(err, ErrInvalidResetCode) {
			t.Fatalf("attempt %d: want ErrInvalidResetCode, got %v", i, err)
		}
	}
	if _, err := svc.ResetPassword(ctx, "brute@example.com", code, "new-password-1"); !errors.Is(err, ErrInvalidResetCode) {
		t.Fatalf("the request should be burned after %d wrong guesses, got %v", resetMaxAttempts, err)
	}
}
