package handler

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/naufalhakim23/financi-ally/backend/internal/auth"
	"github.com/naufalhakim23/financi-ally/backend/internal/pkg/ctxkey"
)

// The spec validator reads and re-serves every request body so it can check it
// against the schema. For JSON that is invisible; for the one multipart endpoint
// it is a live risk, because the generated handler calls r.MultipartReader(),
// which fails outright if anything upstream already consumed or form-parsed the
// body. This runs the real middleware over a real multipart request and asserts
// the bytes arrive downstream intact.
func TestSpecValidatorLeavesMultipartReadable(t *testing.T) {
	validator, err := SpecValidator()
	if err != nil {
		t.Fatalf("SpecValidator: %v", err)
	}

	// JPEG magic, so the payload is what the service would actually sniff.
	want := []byte{0xFF, 0xD8, 0xFF, 0xE0, 'p', 'a', 'y', 'l', 'o', 'a', 'd'}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	part, err := mw.CreateFormFile("image", "receipt.jpg")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := part.Write(want); err != nil {
		t.Fatalf("write part: %v", err)
	}
	if err := mw.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	var got []byte
	var readErr error
	next := http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		reader, err := r.MultipartReader()
		if err != nil {
			readErr = err
			return
		}
		got, readErr = readImagePart(reader)
	})

	// The validator enforces bearerAuth off the principal AuthInject would have
	// put in context; this stands in for a verified token.
	withPrincipal := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p := &auth.Principal{UserID: "u1", LedgerID: "l1", LedgerCurrency: "IDR"}
			h.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxkey.Auth, p)))
		})
	}

	req := httptest.NewRequest(http.MethodPost, "/scan/receipt", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer test")
	rec := httptest.NewRecorder()

	withPrincipal(validator(next)).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("validator rejected the request: %d %s", rec.Code, rec.Body.String())
	}
	if readErr != nil {
		t.Fatalf("downstream could not read the multipart body: %v", readErr)
	}
	if !bytes.Equal(got, want) {
		t.Errorf("image bytes = %v, want %v", got, want)
	}
}

// readImagePart must reject anything that is not exactly one bounded "image"
// part — an empty body, a differently-named field, or an oversized upload.
func TestReadImagePartRejectsBadUploads(t *testing.T) {
	t.Run("nil body", func(t *testing.T) {
		if _, err := readImagePart(nil); err == nil {
			t.Error("nil body accepted, want error")
		}
	})

	t.Run("wrong field name", func(t *testing.T) {
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		part, _ := mw.CreateFormFile("photo", "receipt.jpg")
		_, _ = part.Write([]byte{0xFF, 0xD8, 0xFF})
		_ = mw.Close()

		r := multipart.NewReader(&buf, mw.Boundary())
		if _, err := readImagePart(r); err == nil {
			t.Error("part named \"photo\" accepted, want error")
		}
	})

	t.Run("empty part", func(t *testing.T) {
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		_, _ = mw.CreateFormFile("image", "receipt.jpg")
		_ = mw.Close()

		r := multipart.NewReader(&buf, mw.Boundary())
		if _, err := readImagePart(r); err == nil {
			t.Error("empty image accepted, want error")
		}
	})
}
