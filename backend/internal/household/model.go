// Package household owns ledgers (books of accounts) and who may open them.
// Every other package is scoped to a ledger id; this package is what turns an
// authenticated user into one.
package household

import "time"

// Ledger kinds. A user has exactly one personal ledger, created on demand, and
// any number of household ledgers they created or joined.
const (
	KindPersonal  = "personal"
	KindHousehold = "household"
)

// Membership roles. Owners manage membership and invites; members do everything
// else. Deliberately two roles — a read-only viewer would put a role check on
// every write path in the service, which nothing yet asks for.
const (
	RoleOwner  = "owner"
	RoleMember = "member"
)

// Ledger is a book of accounts.
type Ledger struct {
	ID           string
	Name         string
	BaseCurrency string
	Kind         string
	CreatedBy    string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// Membership is a ledger the caller belongs to, with their role in it.
type Membership struct {
	Ledger   Ledger
	Role     string
	JoinedAt time.Time
}

// Member is one participant in a ledger, for the members list.
type Member struct {
	UserID   string
	Email    string
	Role     string
	JoinedAt time.Time
}

// Invite is an outstanding join code.
type Invite struct {
	Code      string
	LedgerID  string
	ExpiresAt time.Time
	CreatedAt time.Time
}

// Scope is what the auth middleware resolves per request and what handlers pass
// down: the active ledger, plus the caller's role in it. BaseCurrency travels
// here so reporting handlers don't re-read the user row on every call.
type Scope struct {
	LedgerID     string
	BaseCurrency string
	Role         string
}

// IsOwner reports whether the caller may manage membership in this ledger.
func (s Scope) IsOwner() bool { return s.Role == RoleOwner }
