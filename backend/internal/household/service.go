package household

import (
	"context"
	"crypto/rand"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/money"
)

// Service-level sentinels. The handler maps this domain vocabulary to HTTP.
var (
	// ErrInvalidInput: malformed name, currency, or join code.
	ErrInvalidInput = errors.New("invalid input")
	// ErrNotOwner: the action needs the owner role and the caller is a member.
	ErrNotOwner = errors.New("owner role required")
	// ErrPersonalLedger: personal books have no membership to manage.
	ErrPersonalLedger = errors.New("personal ledgers cannot be shared")
)

// InviteTTL is how long a join code stays live. Short enough that a code left
// in a chat thread doesn't stay a valid credential for weeks.
const InviteTTL = 7 * 24 * time.Hour

// Service orchestrates ledgers, membership and join codes.
type Service struct {
	repo *Repo
}

// NewService wires the service with its repo.
func NewService(repo *Repo) *Service { return &Service{repo: repo} }

// Resolve turns an authenticated user plus an optional requested ledger id into
// the request's scope. Empty ledgerID means "my personal book", created on
// first use so that ledger creation stays out of the register/OAuth paths and
// users who existed before M8 are covered too.
func (s *Service) Resolve(ctx context.Context, userID, ledgerID string) (*Scope, error) {
	if ledgerID != "" {
		return s.repo.Scope(ctx, userID, ledgerID)
	}
	l, err := s.repo.PersonalLedger(ctx, userID)
	if errors.Is(err, ErrLedgerNotFound) {
		if l, err = s.createPersonal(ctx, userID); err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	return &Scope{LedgerID: l.ID, BaseCurrency: l.BaseCurrency, Role: RoleOwner}, nil
}

// createPersonal makes the user's personal book, seeded with the base currency
// they registered with. Two concurrent first-requests race here; the unique
// index picks a winner and the loser re-reads it.
func (s *Service) createPersonal(ctx context.Context, userID string) (*Ledger, error) {
	cur, err := s.repo.UserBaseCurrency(ctx, userID)
	if err != nil {
		return nil, err
	}
	l, err := s.repo.CreateLedger(ctx, uuid.NewString(), "Personal", cur, KindPersonal, userID)
	if errors.Is(err, ErrPersonalExists) {
		return s.repo.PersonalLedger(ctx, userID)
	}
	return l, err
}

// List returns every ledger the caller can open.
func (s *Service) List(ctx context.Context, userID string) ([]Membership, error) {
	// Touch Resolve first so a user who has never made a request still sees
	// their personal book in the list.
	if _, err := s.Resolve(ctx, userID, ""); err != nil {
		return nil, err
	}
	return s.repo.Memberships(ctx, userID)
}

// Create makes a new household book with the caller as owner.
func (s *Service) Create(ctx context.Context, userID, name, baseCurrency string) (*Ledger, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 80 {
		return nil, ErrInvalidInput
	}
	baseCurrency = strings.ToUpper(strings.TrimSpace(baseCurrency))
	if baseCurrency == "" {
		cur, err := s.repo.UserBaseCurrency(ctx, userID)
		if err != nil {
			return nil, err
		}
		baseCurrency = cur
	}
	if !money.IsAlpha3(baseCurrency) {
		return nil, ErrInvalidInput
	}
	return s.repo.CreateLedger(ctx, uuid.NewString(), name, baseCurrency, KindHousehold, userID)
}

// Members lists a ledger's participants. Any member may see who else is in the
// book they are already reading the money of.
func (s *Service) Members(ctx context.Context, userID, ledgerID string) ([]Member, error) {
	if _, err := s.repo.Scope(ctx, userID, ledgerID); err != nil {
		return nil, err
	}
	return s.repo.Members(ctx, ledgerID)
}

// Invite issues a join code for a household book. Owner-only: a member who
// could mint codes would be an owner in all but name.
func (s *Service) Invite(ctx context.Context, userID, ledgerID string) (*Invite, error) {
	scope, err := s.repo.Scope(ctx, userID, ledgerID)
	if err != nil {
		return nil, err
	}
	if !scope.IsOwner() {
		return nil, ErrNotOwner
	}
	l, err := s.repo.LedgerByID(ctx, ledgerID)
	if err != nil {
		return nil, err
	}
	if l.Kind == KindPersonal {
		return nil, ErrPersonalLedger
	}
	code, err := newJoinCode()
	if err != nil {
		return nil, err
	}
	return s.repo.CreateInvite(ctx, code, ledgerID, userID, time.Now().Add(InviteTTL))
}

// Join redeems a code and adds the caller as a member. Already being a member
// succeeds: the caller's intent is already satisfied.
func (s *Service) Join(ctx context.Context, userID, code string) (*Ledger, error) {
	code = normalizeCode(code)
	if len(code) != codeLen {
		return nil, ErrInvalidInput
	}
	ledgerID, err := s.repo.RedeemInvite(ctx, code)
	if err != nil {
		return nil, err
	}
	if err := s.repo.AddMember(ctx, ledgerID, userID, RoleMember); err != nil {
		return nil, err
	}
	return s.repo.LedgerByID(ctx, ledgerID)
}

// RemoveMember drops someone from a household book. Owners may remove anyone;
// members may remove only themselves (leaving). An owner leaving is allowed:
// the repo hands the book to the next member, or closes it if that was the last
// one. Blocking it instead would strand the owner, since nothing in the API can
// promote a successor for them.
func (s *Service) RemoveMember(ctx context.Context, actorID, ledgerID, targetID string) error {
	scope, err := s.repo.Scope(ctx, actorID, ledgerID)
	if err != nil {
		return err
	}
	if !scope.IsOwner() && actorID != targetID {
		return ErrNotOwner
	}
	l, err := s.repo.LedgerByID(ctx, ledgerID)
	if err != nil {
		return err
	}
	// Leaving a personal book would close it and silently orphan its money, and
	// the next request would quietly hand the user an empty replacement.
	if l.Kind == KindPersonal {
		return ErrPersonalLedger
	}
	return s.repo.RemoveMember(ctx, ledgerID, targetID)
}

// --- join codes ------------------------------------------------------------

// codeAlphabet is Crockford base32 without I, L, O and U: nothing a human can
// confuse reading a code aloud or off a screen.
const codeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// codeLen of 8 over a 32-symbol alphabet is 40 bits, far past guessable for a
// credential that also expires and can be revoked.
const codeLen = 8

// newJoinCode draws a code from crypto/rand. Rejection-free because the
// alphabet length divides 256 evenly (256 / 32 = 8), so no modulo bias.
func newJoinCode() (string, error) {
	buf := make([]byte, codeLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, codeLen)
	for i, b := range buf {
		out[i] = codeAlphabet[int(b)%len(codeAlphabet)]
	}
	return string(out), nil
}

// normalizeCode forgives how a code was typed: case, surrounding space, and
// the hyphens people insert to break up a long string.
func normalizeCode(code string) string {
	return strings.ToUpper(strings.NewReplacer("-", "", " ", "").Replace(strings.TrimSpace(code)))
}
