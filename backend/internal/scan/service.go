package scan

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/money"
)

// Guard for when the model ignores the instruction to return a short name.
const maxMerchantLen = 120

// Service turns an uploaded photo into a draft. It has no access to ledger.Post
// — a scan cannot write money by construction.
type Service struct {
	repo       *Repo
	blobs      BlobStore
	extractor  Extractor
	dailyLimit int
}

// dailyLimit caps scans per user per UTC day; zero or less disables the cap.
func NewService(repo *Repo, blobs BlobStore, extractor Extractor, dailyLimit int) *Service {
	return &Service{repo: repo, blobs: blobs, extractor: extractor, dailyLimit: dailyLimit}
}

// Scan extracts a proposal, then stores the image. That order costs no writes
// for a photo the model cannot read, at the price of a storage failure discarding
// one paid call — the cheaper of the two mistakes.
//
// fallbackCurrency is the ledger's own, used when the receipt does not say.
func (s *Service) Scan(ctx context.Context, ledgerID, userID string, image []byte, categories []CategoryOption, fallbackCurrency string) (*Draft, error) {
	// Trust boundary: the bytes decide what they are, never the declared type.
	if len(image) == 0 || len(image) > MaxImageBytes {
		return nil, ErrInvalidImage
	}
	mime := http.DetectContentType(image)
	if _, ok := allowedMIME[mime]; !ok {
		return nil, ErrInvalidImage
	}

	// Claimed after the free checks and before the paid work: a rejected image
	// spends nothing, and the model never runs unclaimed.
	if s.dailyLimit > 0 {
		ok, err := s.repo.ConsumeQuota(ctx, userID, s.dailyLimit)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrQuotaExceeded
		}
	}

	ext, err := s.extractor.Extract(ctx, mime, image, categories)
	if err != nil {
		return nil, err
	}
	draft, err := toDraft(ext, categories, fallbackCurrency)
	if err != nil {
		return nil, err
	}

	id := uuid.NewString()
	// Key stored rather than derived, so an object store can mint its own shape
	// later without migrating the metadata table.
	if err := s.blobs.Put(ctx, id, mime, image); err != nil {
		return nil, err
	}
	att := &Attachment{ID: id, LedgerID: ledgerID, MIME: mime, SizeBytes: len(image), StorageKey: id}
	if err := s.repo.Create(ctx, att); err != nil {
		// Without a metadata row nothing would ever reference or reap these.
		if delErr := s.blobs.Delete(ctx, []string{id}); delErr != nil {
			slog.Error("orphaned attachment blob", "key", id, "err", delErr)
		}
		return nil, err
	}
	draft.AttachmentID = id
	return draft, nil
}

// toDraft converts a raw extraction, treating every field as untrusted input.
func toDraft(e *Extraction, categories []CategoryOption, fallbackCurrency string) (*Draft, error) {
	currency := strings.ToUpper(strings.TrimSpace(e.Currency))
	if !money.IsAlpha3(currency) {
		currency = strings.ToUpper(strings.TrimSpace(fallbackCurrency))
	}
	if !money.IsAlpha3(currency) {
		return nil, ErrUnreadable
	}

	minor, err := money.ToMinor(currency, strings.TrimSpace(e.Total))
	if err != nil || minor <= 0 {
		// No legible total means there is nothing to confirm.
		return nil, ErrUnreadable
	}

	confidence := e.Confidence
	if confidence < 0 {
		confidence = 0
	} else if confidence > 1 {
		confidence = 1
	}

	d := &Draft{
		Merchant:    truncate(strings.TrimSpace(e.Merchant), maxMerchantLen),
		Currency:    currency,
		AmountMinor: minor,
		Confidence:  confidence,
		TxnDate:     time.Now(),
	}
	if parsed, err := time.Parse(time.DateOnly, strings.TrimSpace(e.TxnDate)); err == nil {
		d.TxnDate = parsed
	}

	// A wrong category is worse than an empty one: empty makes the human choose,
	// wrong invites a thoughtless confirm.
	if confidence >= minConfidence {
		for _, c := range categories {
			if c.ID == e.CategoryID {
				id := c.ID
				d.CategoryID = &id
				break
			}
		}
	}
	return d, nil
}

// Link binds a scanned image to a confirmed entry. Called after ledger.Post.
func (s *Service) Link(ctx context.Context, ledgerID, attachmentID, entryID string) error {
	return s.repo.Link(ctx, ledgerID, attachmentID, entryID)
}

// Image returns an entry's stored receipt.
func (s *Service) Image(ctx context.Context, ledgerID, entryID string) (string, []byte, error) {
	att, err := s.repo.ByEntry(ctx, ledgerID, entryID)
	if err != nil {
		return "", nil, err
	}
	data, err := s.blobs.Get(ctx, att.StorageKey)
	if err != nil {
		return "", nil, err
	}
	return att.MIME, data, nil
}

// ReapUnlinked deletes images whose draft was never confirmed, plus bytes whose
// metadata row went away by cascade — deleting a ledger takes its attachment
// rows with it and cannot reach the blobs. Returns how many went.
func (s *Service) ReapUnlinked(ctx context.Context, olderThan time.Duration) (int, error) {
	cutoff := time.Now().Add(-olderThan)
	keys, err := s.repo.DeleteUnlinkedBefore(ctx, cutoff)
	if err != nil {
		return 0, err
	}
	// Untidy, not incorrect — so it doesn't abort the image sweep.
	if err := s.repo.DeleteUsageBefore(ctx, time.Now().UTC()); err != nil {
		slog.Error("reap scan usage", "err", err)
	}
	if err := s.blobs.Delete(ctx, keys); err != nil {
		// Rows are already gone: unreachable garbage, not a correctness problem.
		return len(keys), err
	}
	if oc, ok := s.blobs.(OrphanCollector); ok {
		n, err := oc.DeleteOrphansBefore(ctx, cutoff)
		if err != nil {
			return len(keys), err
		}
		return len(keys) + n, nil
	}
	return len(keys), nil
}

// Cuts on rune boundaries: merchant names are routinely non-ASCII.
func truncate(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}
