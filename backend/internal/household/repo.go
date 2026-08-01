package household

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Data-origin sentinels; the service maps these to HTTP.
var (
	// ErrLedgerNotFound: no such ledger, or the caller is not a member of it.
	// One error for both on purpose: "exists but you can't see it" is a leak.
	ErrLedgerNotFound = errors.New("ledger not found")
	// ErrPersonalExists: a personal ledger already exists for this user. Raised
	// by the unique index when two first-requests race.
	ErrPersonalExists = errors.New("personal ledger already exists")
	// ErrInviteInvalid: unknown, expired, or revoked code.
	ErrInviteInvalid = errors.New("invite code is invalid or expired")
)

// Repo is the persistence boundary for ledgers, membership and invites.
type Repo struct {
	db *pgxpool.Pool
}

// NewRepo wires the repo to a pgx pool.
func NewRepo(pool *pgxpool.Pool) *Repo { return &Repo{db: pool} }

const colLedger = "id, name, base_currency, kind, created_by, created_at, updated_at"

func scanLedger(row pgx.Row) (*Ledger, error) {
	l := &Ledger{}
	if err := row.Scan(&l.ID, &l.Name, &l.BaseCurrency, &l.Kind, &l.CreatedBy,
		&l.CreatedAt, &l.UpdatedAt); err != nil {
		return nil, err
	}
	return l, nil
}

// CreateLedger inserts a ledger and its creator's owner membership in one
// transaction; a ledger with no members would be unreachable by anyone.
func (r *Repo) CreateLedger(ctx context.Context, id, name, baseCurrency, kind, createdBy string) (*Ledger, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin create ledger: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	l, err := scanLedger(tx.QueryRow(ctx,
		`INSERT INTO ledgers (id, name, base_currency, kind, created_by)
		 VALUES ($1, $2, $3, $4, $5) RETURNING `+colLedger,
		id, name, baseCurrency, kind, createdBy))
	if err != nil {
		// The only unique index on ledgers is one-personal-book-per-user, and it
		// can only fire for a personal insert. Household inserts carry a fresh
		// uuid, so a violation there is a real fault and must not be swallowed.
		if kind == KindPersonal && isUniqueViolation(err) {
			return nil, ErrPersonalExists
		}
		return nil, fmt.Errorf("insert ledger: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO ledger_members (ledger_id, user_id, role) VALUES ($1, $2, $3)`,
		l.ID, createdBy, RoleOwner); err != nil {
		return nil, fmt.Errorf("insert owner membership: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit create ledger: %w", err)
	}
	return l, nil
}

// PersonalLedger returns the user's personal book, or ErrLedgerNotFound.
func (r *Repo) PersonalLedger(ctx context.Context, userID string) (*Ledger, error) {
	l, err := scanLedger(r.db.QueryRow(ctx,
		`SELECT `+colLedger+` FROM ledgers
		 WHERE created_by = $1 AND kind = 'personal' AND deleted_at IS NULL`, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLedgerNotFound
		}
		return nil, fmt.Errorf("personal ledger: %w", err)
	}
	return l, nil
}

// LedgerByID fetches a ledger without a membership check. Callers must
// establish scope first.
func (r *Repo) LedgerByID(ctx context.Context, id string) (*Ledger, error) {
	l, err := scanLedger(r.db.QueryRow(ctx,
		`SELECT `+colLedger+` FROM ledgers WHERE id = $1 AND deleted_at IS NULL`, id))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLedgerNotFound
		}
		return nil, fmt.Errorf("get ledger: %w", err)
	}
	return l, nil
}

// UserBaseCurrency reads the currency a user registered with; it seeds the
// base currency of any book they create.
func (r *Repo) UserBaseCurrency(ctx context.Context, userID string) (string, error) {
	var cur string
	if err := r.db.QueryRow(ctx,
		`SELECT base_currency FROM users WHERE id = $1`, userID).Scan(&cur); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrLedgerNotFound
		}
		return "", fmt.Errorf("user base currency: %w", err)
	}
	return cur, nil
}

// Memberships lists every ledger the user can open, personal book first.
func (r *Repo) Memberships(ctx context.Context, userID string) ([]Membership, error) {
	rows, err := r.db.Query(ctx,
		`SELECT l.id, l.name, l.base_currency, l.kind, l.created_by, l.created_at, l.updated_at,
		        m.role, m.joined_at
		 FROM ledger_members m
		 JOIN ledgers l ON l.id = m.ledger_id AND l.deleted_at IS NULL
		 WHERE m.user_id = $1
		 ORDER BY (l.kind = 'personal') DESC, l.created_at`, userID)
	if err != nil {
		return nil, fmt.Errorf("list memberships: %w", err)
	}
	defer rows.Close()
	var out []Membership
	for rows.Next() {
		var m Membership
		if err := rows.Scan(&m.Ledger.ID, &m.Ledger.Name, &m.Ledger.BaseCurrency, &m.Ledger.Kind,
			&m.Ledger.CreatedBy, &m.Ledger.CreatedAt, &m.Ledger.UpdatedAt,
			&m.Role, &m.JoinedAt); err != nil {
			return nil, fmt.Errorf("scan membership: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// Scope resolves one ledger for one user in a single query. This runs on every
// authenticated request, which is why it is one indexed join and not a fetch
// plus a membership check.
// ponytail: uncached. If per-request latency ever shows up, memoize by
// (userID, ledgerID) with a short TTL and bust it on membership change.
func (r *Repo) Scope(ctx context.Context, userID, ledgerID string) (*Scope, error) {
	s := &Scope{}
	err := r.db.QueryRow(ctx,
		`SELECT l.id, l.base_currency, m.role
		 FROM ledger_members m
		 JOIN ledgers l ON l.id = m.ledger_id AND l.deleted_at IS NULL
		 WHERE m.user_id = $1 AND m.ledger_id = $2`, userID, ledgerID).
		Scan(&s.LedgerID, &s.BaseCurrency, &s.Role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLedgerNotFound
		}
		return nil, fmt.Errorf("resolve scope: %w", err)
	}
	return s, nil
}

// Members lists a ledger's participants with their emails.
func (r *Repo) Members(ctx context.Context, ledgerID string) ([]Member, error) {
	rows, err := r.db.Query(ctx,
		`SELECT u.id, u.email, m.role, m.joined_at
		 FROM ledger_members m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.ledger_id = $1
		 ORDER BY (m.role = 'owner') DESC, m.joined_at`, ledgerID)
	if err != nil {
		return nil, fmt.Errorf("list members: %w", err)
	}
	defer rows.Close()
	var out []Member
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.UserID, &m.Email, &m.Role, &m.JoinedAt); err != nil {
			return nil, fmt.Errorf("scan member: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// AddMember joins a user to a ledger. Re-joining is a no-op so a double-tapped
// invite code doesn't fail the second time.
func (r *Repo) AddMember(ctx context.Context, ledgerID, userID, role string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO ledger_members (ledger_id, user_id, role) VALUES ($1, $2, $3)
		 ON CONFLICT (ledger_id, user_id) DO NOTHING`, ledgerID, userID, role)
	if err != nil {
		return fmt.Errorf("add member: %w", err)
	}
	return nil
}

// RemoveMember drops a membership and keeps the book reachable afterwards: if
// no owner is left, the longest-standing remaining member is promoted; if
// nobody is left at all, the book is closed. One transaction over a locked
// ledger row, so two people leaving at once can't both see an owner that is on
// their way out. Idempotent.
func (r *Repo) RemoveMember(ctx context.Context, ledgerID, userID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin remove member: %w", err)
	}
	defer tx.Rollback(ctx) // noop after commit

	if _, err := tx.Exec(ctx, `SELECT 1 FROM ledgers WHERE id = $1 FOR UPDATE`, ledgerID); err != nil {
		return fmt.Errorf("lock ledger: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM ledger_members WHERE ledger_id = $1 AND user_id = $2`, ledgerID, userID); err != nil {
		return fmt.Errorf("remove member: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE ledger_members SET role = 'owner'
		 WHERE ledger_id = $1
		   AND user_id = (SELECT user_id FROM ledger_members
		                  WHERE ledger_id = $1 ORDER BY joined_at, user_id LIMIT 1)
		   AND NOT EXISTS (SELECT 1 FROM ledger_members
		                   WHERE ledger_id = $1 AND role = 'owner')`, ledgerID); err != nil {
		return fmt.Errorf("promote successor: %w", err)
	}
	if _, err := tx.Exec(ctx,
		`UPDATE ledgers SET deleted_at = now(), updated_at = now()
		 WHERE id = $1 AND deleted_at IS NULL
		   AND NOT EXISTS (SELECT 1 FROM ledger_members WHERE ledger_id = $1)`, ledgerID); err != nil {
		return fmt.Errorf("close empty ledger: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit remove member: %w", err)
	}
	return nil
}

// CreateInvite stores a join code, revoking any previous one for the ledger:
// one live code per book keeps "who did I give this to" answerable.
func (r *Repo) CreateInvite(ctx context.Context, code, ledgerID, createdBy string, expiresAt time.Time) (*Invite, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin create invite: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`UPDATE ledger_invites SET revoked_at = now() WHERE ledger_id = $1 AND revoked_at IS NULL`,
		ledgerID); err != nil {
		return nil, fmt.Errorf("revoke prior invites: %w", err)
	}
	inv := &Invite{}
	if err := tx.QueryRow(ctx,
		`INSERT INTO ledger_invites (code, ledger_id, created_by, expires_at)
		 VALUES ($1, $2, $3, $4) RETURNING code, ledger_id, expires_at, created_at`,
		code, ledgerID, createdBy, expiresAt).
		Scan(&inv.Code, &inv.LedgerID, &inv.ExpiresAt, &inv.CreatedAt); err != nil {
		return nil, fmt.Errorf("insert invite: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit create invite: %w", err)
	}
	return inv, nil
}

// RedeemInvite resolves a live code to its ledger id.
func (r *Repo) RedeemInvite(ctx context.Context, code string) (string, error) {
	var ledgerID string
	err := r.db.QueryRow(ctx,
		`SELECT ledger_id FROM ledger_invites
		 WHERE code = $1 AND revoked_at IS NULL AND expires_at > now()`, code).Scan(&ledgerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrInviteInvalid
		}
		return "", fmt.Errorf("redeem invite: %w", err)
	}
	return ledgerID, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
