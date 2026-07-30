// Package ledger owns the double-entry core: accounts (a 5-type chart of
// accounts), journal entries, and their balanced lines. Post is the single
// entrypoint that writes a balanced entry inside one transaction; the balance
// invariant is asserted both in-application and by a Postgres trigger. This is
// the future service boundary if ledger ever splits out.
package ledger

import "time"

// AccountType is one of the five chart-of-accounts types.
type AccountType string

const (
	AccountTypeAsset     AccountType = "asset"     // pockets: BCA, cash, e-wallet
	AccountTypeLiability AccountType = "liability" // pockets: credit card, loan
	AccountTypeIncome    AccountType = "income"    // categories: salary, refund
	AccountTypeExpense   AccountType = "expense"   // categories: groceries, rent
	AccountTypeEquity    AccountType = "equity"    // opening balances, retained
)

// validAccountTypes is the set accepted at the trust boundary.
var validAccountTypes = map[AccountType]bool{
	AccountTypeAsset: true, AccountTypeLiability: true, AccountTypeIncome: true,
	AccountTypeExpense: true, AccountTypeEquity: true,
}

// IsDebitNormal reports whether the account type's natural balance is a debit
// (assets and expenses). Used to sign a raw debit/credit sum into a normal-
// balance-positive figure.
func (t AccountType) IsDebitNormal() bool {
	return t == AccountTypeAsset || t == AccountTypeExpense
}

// DC is the side of a journal line: debit or credit.
type DC string

const (
	DCDebit  DC = "debit"
	DCCredit DC = "credit"
)

func (d DC) Valid() bool { return d == DCDebit || d == DCCredit }

// Account is a pocket (asset/liability) or category (income/expense/equity).
// ParentID is a forward-compat tree hook, not traversed in M2.
type Account struct {
	ID        string
	UserID    string
	Type      AccountType
	Currency  string
	Name      string
	ParentID  *string
	Archived  bool
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt *time.Time
}

// JournalLine is one balanced leg of an entry: an account, a side, and an
// unsigned minor-unit amount.
type JournalLine struct {
	ID          string
	EntryID     string
	AccountID   string
	DC          DC
	AmountMinor int64
	Currency    string
}

// Entry is the journal header plus its lines. Posted entries are immutable —
// corrections are reversing entries, which keeps offline sync conflict-free.
type Entry struct {
	ID        string
	UserID    string
	TxnDate   time.Time
	Status    string
	Currency  string
	FXRate    *string // numeric, as string; nil for single-currency entries (M4)
	Source    string
	Memo      string
	Lines     []JournalLine
	CreatedAt time.Time
	UpdatedAt time.Time
}

// LineInput is one leg supplied to Post. Currency defaults to the entry's
// currency when empty (single-currency entries). For cross-currency (M4) each
// line may specify its own currency; the balance invariant is enforced per-
// currency by the DB trigger (or in-app when fx_rate is set on the entry).
// ID is the client (WatermelonDB) id when posted via sync, or empty for the
// REST path (service assigns a server uuid).
type LineInput struct {
	ID          string
	AccountID   string
	DC          DC
	AmountMinor int64
	Currency    string // empty → entry.Currency
}

// EntryInput is the validated payload Post turns into a posted entry.
// FXRate is a decimal string representing the cross-currency rate when lines
// span multiple currencies; nil for single-currency entries (M2 behavior).
// RecurringRuleID links the entry to the rule that generated it (M6); nil for
// manually posted entries. It is also the idempotency key: a partial unique
// index on (recurring_rule_id, txn_date) makes a repeated materialization of
// the same occurrence fail with ErrDuplicateEntry instead of double-posting.
type EntryInput struct {
	ID              string // client id (sync) or empty (REST → server uuid)
	TxnDate         time.Time
	Currency        string
	FXRate          *string // cross-currency rate (M4); nil for single-currency
	Memo            string
	Source          string
	RecurringRuleID *string
	Lines           []LineInput
}

// Balance is an account's debit/credit totals and the normal-balance-signed
// amount (positive = healthy/normal: assets and expenses positive on debit,
// liabilities/income/equity positive on credit).
type Balance struct {
	AccountID   string
	Currency    string
	DebitMinor  int64
	CreditMinor int64
	SignedMinor int64
}
