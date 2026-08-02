package handler

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"mime/multipart"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/naufalhakim23/financi-ally/backend/api"
	"github.com/naufalhakim23/financi-ally/backend/internal/scan"
)

// ScanReceipt returns a draft for the user to confirm. It posts nothing;
// confirmation travels PostEntry like any other entry.
func (s *ServerImpl) ScanReceipt(ctx context.Context, req api.ScanReceiptRequestObject) (api.ScanReceiptResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.ScanReceipt401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}

	image, err := readImagePart(req.Body)
	if err != nil {
		return api.ScanReceipt400JSONResponse(api.Error{Code: "invalid_image", Message: "expected one image part named \"image\", at most 8 MiB"}), nil
	}

	// The book's own expense accounts are the only categories the model may pick.
	accounts, err := s.ledger.ListAccounts(ctx, p.LedgerID, "expense")
	if err != nil {
		return nil, err
	}
	categories := make([]scan.CategoryOption, 0, len(accounts))
	for _, a := range accounts {
		if a.Archived {
			continue
		}
		categories = append(categories, scan.CategoryOption{ID: a.ID, Name: a.Name})
	}

	draft, err := s.scan.Scan(ctx, p.LedgerID, p.UserID, image, categories, p.LedgerCurrency)
	switch {
	case errors.Is(err, scan.ErrQuotaExceeded):
		return api.ScanReceipt429JSONResponse(api.Error{Code: "quota_exceeded", Message: "daily scan limit reached; try again tomorrow or enter this one by hand"}), nil
	case errors.Is(err, scan.ErrInvalidImage):
		return api.ScanReceipt400JSONResponse(api.Error{Code: "invalid_image", Message: "unsupported or oversized image; send a JPEG, PNG, or WebP under 8 MiB"}), nil
	case errors.Is(err, scan.ErrUnreadable):
		return api.ScanReceipt422JSONResponse(api.Error{Code: "unreadable", Message: "could not read a total from this photo; try a sharper, straighter shot"}), nil
	case err != nil:
		return nil, err
	}
	return api.ScanReceipt200JSONResponse(toAPIDraft(draft)), nil
}

// GetEntryAttachment streams an entry's stored receipt image.
func (s *ServerImpl) GetEntryAttachment(ctx context.Context, req api.GetEntryAttachmentRequestObject) (api.GetEntryAttachmentResponseObject, error) {
	p, ok := PrincipalFrom(ctx)
	if !ok {
		return api.GetEntryAttachment401JSONResponse(api.Error{Code: "unauthenticated", Message: "missing or invalid token"}), nil
	}
	mime, data, err := s.scan.Image(ctx, p.LedgerID, req.Id)
	if errors.Is(err, scan.ErrAttachmentNotFound) {
		return api.GetEntryAttachment404JSONResponse(api.Error{Code: "not_found", Message: "no receipt image for this entry"}), nil
	}
	if err != nil {
		return nil, err
	}
	body, length := bytes.NewReader(data), int64(len(data))
	switch mime {
	case "image/png":
		return api.GetEntryAttachment200ImagepngResponse{Body: body, ContentLength: length}, nil
	case "image/webp":
		return api.GetEntryAttachment200ImagewebpResponse{Body: body, ContentLength: length}, nil
	default:
		return api.GetEntryAttachment200ImagejpegResponse{Body: body, ContentLength: length}, nil
	}
}

// linkAttachment files a scanned photo against a just-confirmed entry. Failures
// are logged, never returned: the entry is already posted, so an error would
// invite a retry that posts it twice. Worst case is an entry without its photo.
func (s *ServerImpl) linkAttachment(ctx context.Context, ledgerID, attachmentID, entryID string) {
	if err := s.scan.Link(ctx, ledgerID, attachmentID, entryID); err != nil {
		slog.Error("link receipt attachment", "entry", entryID, "attachment", attachmentID, "err", err)
	}
}

// readImagePart pulls the single "image" part out of the multipart body,
// bounded rather than trusting Content-Length.
func readImagePart(body *multipart.Reader) ([]byte, error) {
	if body == nil {
		return nil, scan.ErrInvalidImage
	}
	// Without a cap, a client streaming endless differently-named parts holds a
	// connection and goroutine until the request timeout.
	const maxParts = 10
	for range maxParts {
		part, err := body.NextPart()
		if errors.Is(err, io.EOF) {
			return nil, scan.ErrInvalidImage
		}
		if err != nil {
			return nil, scan.ErrInvalidImage
		}
		if part.FormName() != "image" {
			_ = part.Close()
			continue
		}
		// One past the cap: reading exactly the limit cannot tell "fits" from
		// "was truncated".
		data, err := io.ReadAll(io.LimitReader(part, scan.MaxImageBytes+1))
		_ = part.Close()
		if err != nil || len(data) == 0 || len(data) > scan.MaxImageBytes {
			return nil, scan.ErrInvalidImage
		}
		return data, nil
	}
	return nil, scan.ErrInvalidImage
}

// CategoryId stays nil when the model was unsure — the client makes the user
// choose rather than defaulting.
func toAPIDraft(d *scan.Draft) api.ReceiptDraft {
	confidence := float32(d.Confidence)
	return api.ReceiptDraft{
		AttachmentId: d.AttachmentID,
		Merchant:     d.Merchant,
		TxnDate:      openapi_types.Date{Time: d.TxnDate},
		Currency:     d.Currency,
		AmountMinor:  d.AmountMinor,
		CategoryId:   d.CategoryID,
		Confidence:   confidence,
	}
}
