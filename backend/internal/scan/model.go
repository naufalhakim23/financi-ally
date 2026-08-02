// Package scan turns a photographed receipt into a *draft* entry for a human to
// confirm. It never posts: the confirmed result travels the same ledger.Post
// path a hand-typed entry does. The model proposes; Post decides.
package scan

import (
	"context"
	"errors"
	"time"
)

// Boundary sentinels. The handler maps these to HTTP; nothing here leaks a
// provider error string to a client.
var (
	// Empty, oversized, or unsupported upload. Rejected before any paid call.
	ErrInvalidImage = errors.New("invalid image")
	// The extractor ran but found no usable amount.
	ErrUnreadable         = errors.New("receipt unreadable")
	ErrAttachmentNotFound = errors.New("attachment not found")
	// Raised before the model call, so hitting it costs nothing.
	ErrQuotaExceeded = errors.New("scan quota exceeded")
)

// A downscaled phone JPEG is well under this; the cap stops a hostile upload
// reaching the model or Postgres.
const MaxImageBytes = 8 << 20 // 8 MiB

// Floor below which a proposed category is discarded.
const minConfidence = 0.6

// What the vision API accepts, mirrored by the DB constraint.
var allowedMIME = map[string]struct{}{
	"image/jpeg": {},
	"image/png":  {},
	"image/webp": {},
}

// CategoryOption is one expense account the model may choose from. Offering the
// ledger's real ids is what stops it inventing one.
type CategoryOption struct {
	ID   string
	Name string
}

// Extraction is the raw shape the vision model fills in. Every field is a string
// because a model is a text generator; validation happens here, not there.
type Extraction struct {
	Merchant   string  `json:"merchant"`
	TxnDate    string  `json:"txn_date"`
	Currency   string  `json:"currency"`
	Total      string  `json:"total"`
	CategoryID string  `json:"category_id"`
	Confidence float64 `json:"confidence"`
}

// Draft is a validated proposal. It is not an entry and has never touched the
// journal.
type Draft struct {
	AttachmentID string
	Merchant     string
	TxnDate      time.Time
	Currency     string
	AmountMinor  int64
	// Nil when the model was unsure or named an account this ledger lacks.
	CategoryID *string
	Confidence float64
}

// Attachment is the stored image's metadata. The bytes live behind BlobStore.
type Attachment struct {
	ID         string
	LedgerID   string
	EntryID    *string
	MIME       string
	SizeBytes  int
	StorageKey string
	CreatedAt  time.Time
}

// Extractor is the vision boundary. One implementation calls Claude; the other
// returns a fixed draft so local development and tests run without a key.
type Extractor interface {
	Extract(ctx context.Context, mime string, image []byte, categories []CategoryOption) (*Extraction, error)
}

// BlobStore holds attachment bytes. Postgres implements it today; an object
// store can tomorrow without touching the metadata table.
type BlobStore interface {
	Put(ctx context.Context, key, mime string, data []byte) error
	Get(ctx context.Context, key string) ([]byte, error)
	Delete(ctx context.Context, keys []string) error
}

// OrphanCollector drops bytes whose metadata row no longer exists — deleting a
// ledger cascades entry_attachments away and cannot reach the blobs, so without
// this they leak permanently.
//
// Optional because an object store answers this with a lifecycle rule; the
// reaper type-asserts and skips stores that do not implement it.
type OrphanCollector interface {
	DeleteOrphansBefore(ctx context.Context, cutoff time.Time) (int, error)
}
