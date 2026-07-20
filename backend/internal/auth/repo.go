package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Data-origin sentinel errors. The service layer maps these to HTTP statuses.
var (
	// ErrUserNotFound: no row matched the lookup.
	ErrUserNotFound = errors.New("user not found")
	// ErrEmailExists: a register/insert hit the users.email unique constraint.
	ErrEmailExists = errors.New("email already registered")
)

// Repo is the persistence boundary for auth. Raw SQL via pgx; goqu/query
// builder lands in M2 where the ledger queries get complex; these CRUD calls
// are clearer as plain SQL.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo wires the repo to a pgx pool.
func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

const (
	colUser = "id, email, password_hash, base_currency, created_at"
)

func scanUser(row pgx.Row) (*User, error) {
	u := &User{}
	if err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.BaseCurrency, &u.CreatedAt); err != nil {
		return nil, err
	}
	return u, nil
}

// CreateUser inserts a user. passwordHash may be nil for OAuth-only accounts.
// A colliding email maps to ErrEmailExists so callers can return 409 not 500.
func (r *Repo) CreateUser(ctx context.Context, email string, passwordHash *string, baseCurrency string) (*User, error) {
	const q = `INSERT INTO users (email, password_hash, base_currency)
		VALUES ($1, $2, $3)
		RETURNING ` + colUser
	u, err := scanUser(r.db.QueryRow(ctx, q, email, passwordHash, baseCurrency))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrEmailExists
		}
		return nil, fmt.Errorf("create user: %w", err)
	}
	return u, nil
}

// GetUserByEmail fetches by email. Missing row → ErrUserNotFound.
func (r *Repo) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	u, err := scanUser(r.db.QueryRow(ctx, `SELECT `+colUser+` FROM users WHERE email = $1`, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	return u, nil
}

// GetUserByID fetches by primary key. Missing row → ErrUserNotFound.
func (r *Repo) GetUserByID(ctx context.Context, id string) (*User, error) {
	u, err := scanUser(r.db.QueryRow(ctx, `SELECT `+colUser+` FROM users WHERE id = $1`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return u, nil
}

// CreateRefreshToken stores a hashed refresh token for a user.
func (r *Repo) CreateRefreshToken(ctx context.Context, userID string, tokenHash []byte, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt)
	if err != nil {
		return fmt.Errorf("create refresh token: %w", err)
	}
	return nil
}

// RotateRefreshToken atomically revokes the old token (only if still valid) and
// issues the new one in the same transaction, returning the owning user.
// If the old token is missing, already revoked, or expired, nothing is written
// and ErrInvalidToken is returned; that's the single-use-theft signal.
func (r *Repo) RotateRefreshToken(ctx context.Context, oldHash, newHash []byte, newExpiresAt time.Time) (*User, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin rotate tx: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	// Revoke the presented token iff it is currently valid. RETURNING gives us
	// the user_id and confirms a row matched; zero rows = reuse/forgery/expired.
	var userID string
	err = tx.QueryRow(ctx, `
		UPDATE refresh_tokens
		   SET revoked_at = now()
		 WHERE token_hash = $1
		   AND revoked_at IS NULL
		   AND expires_at > now()
		 RETURNING user_id`, oldHash).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInvalidToken
		}
		return nil, fmt.Errorf("revoke old refresh: %w", err)
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, newHash, newExpiresAt); err != nil {
		return nil, fmt.Errorf("insert new refresh: %w", err)
	}

	u, err := scanUser(tx.QueryRow(ctx, `SELECT `+colUser+` FROM users WHERE id = $1`, userID))
	if err != nil {
		return nil, fmt.Errorf("load user in rotate tx: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit rotate tx: %w", err)
	}
	return u, nil
}

// RevokeRefreshToken marks a single token revoked (logout). Idempotent: revoking
// an already-revoked or unknown token is not an error.
func (r *Repo) RevokeRefreshToken(ctx context.Context, userID string, tokenHash []byte) error {
	_, err := r.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked_at = now()
		  WHERE user_id = $1 AND token_hash = $2 AND revoked_at IS NULL`,
		userID, tokenHash)
	if err != nil {
		return fmt.Errorf("revoke refresh token: %w", err)
	}
	return nil
}

// FindOrCreateOAuth links an OAuth identity to a user. If the identity exists,
// returns its user. Otherwise it reuses an existing user with the same email
// (account linking) or creates a fresh OAuth-only user. All in one transaction
// so a partial link can't strand an orphan oauth_identities row.
//
// Concurrent first-ever logins of the same identity race on the
// oauth_identities unique constraint; the whole flow retries a few times so a
// loser of the race re-reads the winner's row instead of surfacing a 5xx.
func (r *Repo) FindOrCreateOAuth(ctx context.Context, provider, providerUID, email string) (*User, error) {
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		u, retry, err := r.tryFindOrCreateOAuth(ctx, provider, providerUID, email)
		if err == nil {
			return u, nil
		}
		if !retry {
			return nil, err
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = ErrEmailExists
	}
	return nil, lastErr
}

// tryFindOrCreateOAuth is one attempt. The retry bool signals "a concurrent
// write beat us; start over" (unique violation on users or oauth_identities);
// any other error is terminal.
func (r *Repo) tryFindOrCreateOAuth(ctx context.Context, provider, providerUID, email string) (*User, bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, false, fmt.Errorf("begin oauth tx: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	// 1. Existing link?
	u, err := scanUser(tx.QueryRow(ctx, `
		SELECT u.`+colUser+`
		  FROM oauth_identities o JOIN users u ON u.id = o.user_id
		 WHERE o.provider = $1 AND o.provider_uid = $2`, provider, providerUID))
	if err == nil {
		if err := tx.Commit(ctx); err != nil {
			return nil, false, fmt.Errorf("commit oauth tx (existing): %w", err)
		}
		return u, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, fmt.Errorf("lookup oauth identity: %w", err)
	}

	// 2. Same-email user to link to?
	u, err = scanUser(tx.QueryRow(ctx, `SELECT `+colUser+` FROM users WHERE email = $1`, email))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// 3. No existing user; create an OAuth-only one (no password).
			u, err = scanUser(tx.QueryRow(ctx, `
				INSERT INTO users (email, password_hash) VALUES ($1, NULL)
				RETURNING `+colUser, email))
			if err != nil {
				if isUniqueViolation(err) {
					return nil, true, ErrEmailExists // email appeared concurrently; re-read
				}
				return nil, false, fmt.Errorf("create oauth user: %w", err)
			}
		} else {
			return nil, false, fmt.Errorf("lookup user by email for oauth: %w", err)
		}
	}

	// 4. Link the identity to whichever user we resolved.
	if _, err := tx.Exec(ctx,
		`INSERT INTO oauth_identities (user_id, provider, provider_uid) VALUES ($1, $2, $3)`,
		u.ID, provider, providerUID); err != nil {
		if isUniqueViolation(err) {
			return nil, true, ErrEmailExists // identity linked concurrently; re-read
		}
		return nil, false, fmt.Errorf("insert oauth identity: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, false, fmt.Errorf("commit oauth tx (new): %w", err)
	}
	return u, false, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
