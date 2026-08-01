package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"fmt"
	"html"
	"log/slog"
	"math/big"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Reset-flow sentinels.
var (
	// ErrInvalidResetCode: no live request, wrong code, expired, or the attempt
	// ceiling was burned. Deliberately one error for all of them — telling the
	// caller which would help a guesser more than a user.
	ErrInvalidResetCode = errors.New("invalid reset code")
	// errResetThrottled is internal: the caller still answers 204, or the
	// throttle itself becomes an enumeration oracle.
	errResetThrottled = errors.New("reset code already issued recently")
)

const (
	// resetTTL is short on purpose: the code sits in a mailbox, which is the
	// weakest link in the chain.
	resetTTL = 15 * time.Minute
	// resetMaxAttempts bounds guessing against the 6-digit space. Five tries
	// against 10^6 is negligible, and it is well above honest mistyping.
	resetMaxAttempts = 5
	// resetMinInterval throttles re-issue. Each new code retires the previous
	// one, so without this a loop keeps invalidating the victim's real code
	// between reading the email and typing it.
	//
	// ponytail: per user, in the row we already lock. Add IP-level throttling
	// middleware when a second endpoint needs it.
	resetMinInterval = 60 * time.Second
)

// RequestPasswordReset issues a reset code and emails it.
//
// It returns nil whether or not the email is registered. The endpoint is
// unauthenticated, so a "no such user" response would turn it into an account
// enumeration oracle; the caller always answers 204.
func (s *Service) RequestPasswordReset(ctx context.Context, email string) error {
	if !validEmail(email) {
		return ErrInvalidInput
	}
	user, err := s.repo.GetUserByEmail(ctx, normalizeEmail(email))
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil // silently succeed; see doc comment
		}
		return err
	}

	code, err := newResetCode()
	if err != nil {
		return err
	}
	// One live code per user: issuing a second must retire the first, or an
	// old email stays usable for its whole TTL after the user asked again.
	if err := s.repo.CreatePasswordReset(ctx, user.ID, hashToken(code), time.Now().Add(resetTTL)); err != nil {
		if errors.Is(err, errResetThrottled) {
			return nil // the previous code is still live and still in their inbox
		}
		return err
	}

	if s.mail == nil {
		// No sender wired at all (a Service built by a test). The code is
		// already persisted, so log rather than fail the request.
		slog.Warn("password reset issued with no mail sender configured", "user_id", user.ID)
		return nil
	}
	// Off the request path: a registered address would otherwise wait on a
	// provider POST while an unregistered one answered instantly, and a provider
	// error would surface as a 500 only registered addresses can produce.
	to, html := user.Email, resetEmailHTML(code)
	go func() {
		sendCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 30*time.Second)
		defer cancel()
		if err := s.mail.Send(sendCtx, to, "Your Financi-Ally reset code", html); err != nil {
			slog.Error("send reset email", "error", err)
		}
	}()
	return nil
}

// ResetPassword verifies the code, sets the new password, and starts a session.
//
// Every existing refresh token is revoked: a reset is the remedy for a
// compromised account, so sessions the attacker may hold must not survive it.
// The user is signed in on this device from the returned session.
func (s *Service) ResetPassword(ctx context.Context, email, code, newPassword string) (*Session, error) {
	if !validEmail(email) || len(newPassword) < minPasswordLen {
		return nil, ErrInvalidInput
	}
	user, err := s.repo.GetUserByEmail(ctx, normalizeEmail(email))
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			return nil, ErrInvalidResetCode // same error as a bad code; no enumeration
		}
		return nil, err
	}

	// Hash before consuming: a transient argon2 failure would otherwise burn
	// the user's only code while changing nothing.
	hash, err := HashPassword(newPassword)
	if err != nil {
		return nil, err
	}
	if err := s.repo.ConsumePasswordReset(ctx, user.ID, hashToken(strings.TrimSpace(code)), resetMaxAttempts); err != nil {
		return nil, err
	}
	if err := s.repo.SetPasswordAndRevokeSessions(ctx, user.ID, hash); err != nil {
		return nil, err
	}
	user.PasswordHash = &hash
	return s.issueSession(ctx, user)
}

// newResetCode returns a uniformly random 6-digit code. crypto/rand, not
// math/rand: this code is a credential.
func newResetCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("generate reset code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func resetEmailHTML(code string) string {
	return `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#1A1F2E">
  <p>Use this code to set a new Financi-Ally password:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,monospace">` +
		html.EscapeString(code) + `</p>
  <p style="color:#5A6379">It expires in 15 minutes. If you didn't ask for it, you can ignore this email — nothing has changed.</p>
</div>`
}

// ─── Persistence ────────────────────────────────────────────────────────────

// CreatePasswordReset retires any live code for the user and stores a new one,
// in one transaction so the two can never both be live.
//
// Returns errResetThrottled when a live code was issued less than
// resetMinInterval ago. FOR UPDATE, so concurrent requests can't both pass.
func (r *Repo) CreatePasswordReset(ctx context.Context, userID string, codeHash []byte, expiresAt time.Time) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin reset tx: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	var recent bool
	err = tx.QueryRow(ctx, `
		SELECT created_at > now() - make_interval(secs => $2)
		  FROM password_resets
		 WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > now()
		 ORDER BY created_at DESC
		 LIMIT 1
		   FOR UPDATE`, userID, resetMinInterval.Seconds()).Scan(&recent)
	switch {
	case errors.Is(err, pgx.ErrNoRows): // no live code; carry on
	case err != nil:
		return fmt.Errorf("check recent reset: %w", err)
	case recent:
		return errResetThrottled
	}

	if _, err := tx.Exec(ctx,
		`UPDATE password_resets SET consumed_at = now()
		  WHERE user_id = $1 AND consumed_at IS NULL`, userID); err != nil {
		return fmt.Errorf("retire previous resets: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO password_resets (user_id, code_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, codeHash, expiresAt); err != nil {
		return fmt.Errorf("create password reset: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit reset tx: %w", err)
	}
	return nil
}

// ConsumePasswordReset validates the presented code against the user's live
// request and marks it used. A wrong code burns an attempt; exhausting the
// ceiling retires the request outright so guessing cannot continue.
//
// The row is locked FOR UPDATE, so two concurrent guesses can't each see
// attempts=4 and both get a try.
func (r *Repo) ConsumePasswordReset(ctx context.Context, userID string, codeHash []byte, maxAttempts int) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin consume tx: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	var id string
	var storedHash []byte
	var attempts int
	err = tx.QueryRow(ctx, `
		SELECT id, code_hash, attempts
		  FROM password_resets
		 WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > now()
		 ORDER BY created_at DESC
		 LIMIT 1
		   FOR UPDATE`, userID).Scan(&id, &storedHash, &attempts)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidResetCode
		}
		return fmt.Errorf("load password reset: %w", err)
	}

	// Constant-time: the hashes are equal-length digests, and a timing signal
	// here would leak a prefix of the correct code.
	if subtle.ConstantTimeCompare(storedHash, codeHash) != 1 {
		attempts++
		consumed := "NULL"
		if attempts >= maxAttempts {
			consumed = "now()"
		}
		if _, err := tx.Exec(ctx,
			`UPDATE password_resets SET attempts = $2, consumed_at = `+consumed+` WHERE id = $1`,
			id, attempts); err != nil {
			return fmt.Errorf("record failed attempt: %w", err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("commit failed attempt: %w", err)
		}
		return ErrInvalidResetCode
	}

	if _, err := tx.Exec(ctx, `UPDATE password_resets SET consumed_at = now() WHERE id = $1`, id); err != nil {
		return fmt.Errorf("consume password reset: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit consume tx: %w", err)
	}
	return nil
}

// SetPasswordAndRevokeSessions writes the new hash and kills every outstanding
// refresh token in the same transaction — a half-applied reset would leave the
// account both re-passworded and still open to old sessions.
func (r *Repo) SetPasswordAndRevokeSessions(ctx context.Context, userID, passwordHash string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin set-password tx: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	if _, err := tx.Exec(ctx,
		`UPDATE users SET password_hash = $2 WHERE id = $1`, userID, passwordHash); err != nil {
		return fmt.Errorf("set password: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = now()
		  WHERE user_id = $1 AND revoked_at IS NULL`, userID); err != nil {
		return fmt.Errorf("revoke sessions after reset: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit set-password tx: %w", err)
	}
	return nil
}
