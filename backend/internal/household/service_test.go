package household

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/db"
)

// newTestService builds a household Service against a real Postgres. Skipped
// when DATABASE_URL is unset so `go test ./...` passes DB-less.
func newTestService(t *testing.T) (*Service, *pgxpool.Pool, func()) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL unset; skipping household integration test")
	}
	if err := db.Migrate(dsn); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE TABLE ledger_invites, ledger_members, ledgers, oauth_identities, refresh_tokens,
		 journal_lines, entries, accounts, budgets, recurring_rules, users RESTART IDENTITY CASCADE`); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return NewService(NewRepo(pool)), pool, func() { pool.Close() }
}

// newUser registers someone to hang memberships off.
func newUser(t *testing.T, pool *pgxpool.Pool, email string) string {
	t.Helper()
	authSvc := auth.NewService(auth.NewRepo(pool), auth.NewJWTService("test-secret", time.Minute),
		auth.NewGoogle("", ""), nil, time.Hour, "IDR")
	sess, err := authSvc.Register(context.Background(), email, "password123", "IDR")
	if err != nil {
		t.Fatalf("register %s: %v", email, err)
	}
	return sess.User.ID
}

// The personal book is created on first resolve and is stable afterwards: a
// second resolve must not mint a second book.
func TestResolveCreatesPersonalLedgerOnce(t *testing.T) {
	svc, pool, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()
	user := newUser(t, pool, "solo@example.com")

	first, err := svc.Resolve(ctx, user, "")
	if err != nil {
		t.Fatalf("first resolve: %v", err)
	}
	if first.Role != RoleOwner || first.BaseCurrency != "IDR" {
		t.Fatalf("personal scope: got role=%s currency=%s, want owner/IDR", first.Role, first.BaseCurrency)
	}
	second, err := svc.Resolve(ctx, user, "")
	if err != nil {
		t.Fatalf("second resolve: %v", err)
	}
	if first.LedgerID != second.LedgerID {
		t.Fatalf("personal ledger not stable: %s then %s", first.LedgerID, second.LedgerID)
	}
}

// The core tenancy guarantee: naming someone else's book must not resolve.
func TestResolveRejectsNonMember(t *testing.T) {
	svc, pool, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()
	owner := newUser(t, pool, "owner@example.com")
	stranger := newUser(t, pool, "stranger@example.com")

	book, err := svc.Create(ctx, owner, "Rumah", "IDR")
	if err != nil {
		t.Fatalf("create household: %v", err)
	}
	if _, err := svc.Resolve(ctx, stranger, book.ID); !errors.Is(err, ErrLedgerNotFound) {
		t.Fatalf("stranger resolve: want ErrLedgerNotFound, got %v", err)
	}
}

// End-to-end sharing: invite → join → both members resolve the same book.
func TestInviteAndJoin(t *testing.T) {
	svc, pool, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()
	owner := newUser(t, pool, "kamil@example.com")
	guest := newUser(t, pool, "ana@example.com")

	book, err := svc.Create(ctx, owner, "Rumah", "IDR")
	if err != nil {
		t.Fatalf("create household: %v", err)
	}
	inv, err := svc.Invite(ctx, owner, book.ID)
	if err != nil {
		t.Fatalf("invite: %v", err)
	}

	// Codes are typed by hand, so redemption must survive case and hyphens.
	joined, err := svc.Join(ctx, guest, "  "+strings.ToLower(inv.Code[:4])+"-"+inv.Code[4:]+" ")
	if err != nil {
		t.Fatalf("join: %v", err)
	}
	if joined.ID != book.ID {
		t.Fatalf("joined the wrong book: %s want %s", joined.ID, book.ID)
	}
	scope, err := svc.Resolve(ctx, guest, book.ID)
	if err != nil {
		t.Fatalf("guest resolve after join: %v", err)
	}
	if scope.Role != RoleMember {
		t.Fatalf("guest role: got %s, want member", scope.Role)
	}
	members, err := svc.Members(ctx, owner, book.ID)
	if err != nil {
		t.Fatalf("members: %v", err)
	}
	if len(members) != 2 || members[0].Role != RoleOwner {
		t.Fatalf("members: got %d with first role %q, want 2 with owner first", len(members), members[0].Role)
	}
}

// Only owners may mint codes, and a personal book has nobody to invite.
func TestInvitePermissions(t *testing.T) {
	svc, pool, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()
	owner := newUser(t, pool, "owner2@example.com")
	guest := newUser(t, pool, "guest2@example.com")

	book, _ := svc.Create(ctx, owner, "Rumah", "IDR")
	inv, _ := svc.Invite(ctx, owner, book.ID)
	if _, err := svc.Join(ctx, guest, inv.Code); err != nil {
		t.Fatalf("join: %v", err)
	}
	if _, err := svc.Invite(ctx, guest, book.ID); !errors.Is(err, ErrNotOwner) {
		t.Fatalf("member invite: want ErrNotOwner, got %v", err)
	}
	personal, _ := svc.Resolve(ctx, owner, "")
	if _, err := svc.Invite(ctx, owner, personal.LedgerID); !errors.Is(err, ErrPersonalLedger) {
		t.Fatalf("personal invite: want ErrPersonalLedger, got %v", err)
	}
}

// A member may leave, and so may the only owner: the book follows them out by
// handing itself to the next member, or closing when nobody is left.
func TestRemoveMemberRules(t *testing.T) {
	svc, pool, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()
	owner := newUser(t, pool, "owner3@example.com")
	guest := newUser(t, pool, "guest3@example.com")

	book, _ := svc.Create(ctx, owner, "Rumah", "IDR")
	inv, _ := svc.Invite(ctx, owner, book.ID)
	if _, err := svc.Join(ctx, guest, inv.Code); err != nil {
		t.Fatalf("join: %v", err)
	}

	// The personal book is nobody's to leave.
	personal, _ := svc.Resolve(ctx, owner, "")
	if err := svc.RemoveMember(ctx, owner, personal.LedgerID, owner); !errors.Is(err, ErrPersonalLedger) {
		t.Fatalf("leaving personal book: want ErrPersonalLedger, got %v", err)
	}

	// The only owner leaves; the remaining member inherits the book.
	if err := svc.RemoveMember(ctx, owner, book.ID, owner); err != nil {
		t.Fatalf("owner leaving: %v", err)
	}
	scope, err := svc.Resolve(ctx, guest, book.ID)
	if err != nil {
		t.Fatalf("successor resolve: %v", err)
	}
	if scope.Role != RoleOwner {
		t.Fatalf("successor role: got %s, want owner", scope.Role)
	}

	// The last member out closes the book.
	if err := svc.RemoveMember(ctx, guest, book.ID, guest); err != nil {
		t.Fatalf("member leaving: %v", err)
	}
	if _, err := svc.Resolve(ctx, guest, book.ID); !errors.Is(err, ErrLedgerNotFound) {
		t.Fatalf("resolve after leaving: want ErrLedgerNotFound, got %v", err)
	}
	var deleted bool
	if err := pool.QueryRow(ctx,
		`SELECT deleted_at IS NOT NULL FROM ledgers WHERE id = $1`, book.ID).Scan(&deleted); err != nil {
		t.Fatalf("read closed ledger: %v", err)
	}
	if !deleted {
		t.Fatal("empty book: want closed, got live")
	}
}

// Issuing a code retires the previous one, so an old code can't be redeemed.
func TestInviteSupersedesPrevious(t *testing.T) {
	svc, pool, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()
	owner := newUser(t, pool, "owner4@example.com")
	guest := newUser(t, pool, "guest4@example.com")

	book, _ := svc.Create(ctx, owner, "Rumah", "IDR")
	old, _ := svc.Invite(ctx, owner, book.ID)
	if _, err := svc.Invite(ctx, owner, book.ID); err != nil {
		t.Fatalf("reissue: %v", err)
	}
	if _, err := svc.Join(ctx, guest, old.Code); !errors.Is(err, ErrInviteInvalid) {
		t.Fatalf("stale code: want ErrInviteInvalid, got %v", err)
	}
}

// List always includes the personal book, even before it has been resolved.
func TestListIncludesPersonal(t *testing.T) {
	svc, pool, cleanup := newTestService(t)
	defer cleanup()
	ctx := context.Background()
	user := newUser(t, pool, "lister@example.com")

	books, err := svc.List(ctx, user)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(books) != 1 || books[0].Ledger.Kind != KindPersonal {
		t.Fatalf("list: got %d books, want 1 personal", len(books))
	}
}
