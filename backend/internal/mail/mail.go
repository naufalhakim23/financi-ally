// Package mail is the outbound-email boundary. One transactional provider
// (Resend, over its REST API — the SDK adds a dependency for one POST) and a
// mock that logs instead of sending, so local development and tests never need
// a key or a verified sending domain.
package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

const resendEndpoint = "https://api.resend.com/emails"

// Sender delivers one transactional message. Implementations must be safe for
// concurrent use.
type Sender interface {
	Send(ctx context.Context, to, subject, html string) error
}

// Config is what Load-ed configuration hands to New.
type Config struct {
	APIKey string
	From   string // e.g. "Financi-Ally <no-reply@financially.app>"
	Mock   bool   // force the logging sender even when a key is present
}

// New picks the sender. No API key (or Mock set) yields the logging sender:
// a missing key is the normal state in development, and failing the boot over
// it would make the whole API un-runnable locally for one optional feature.
// config.Load refuses a production boot with no key and no explicit MAIL_MOCK.
func New(cfg Config) Sender {
	if cfg.Mock || cfg.APIKey == "" {
		slog.Warn("email sending is mocked; messages are logged, not delivered")
		return mockSender{}
	}
	return &resendSender{
		apiKey: cfg.APIKey,
		from:   cfg.From,
		http:   &http.Client{Timeout: 10 * time.Second},
	}
}

// mockSender logs the message body. The body is logged in full on purpose:
// in development the reset code lives in it, and reading the server log is how
// you complete the flow without a mailbox.
type mockSender struct{}

func (mockSender) Send(_ context.Context, to, subject, html string) error {
	slog.Info("email (mock)", "to", to, "subject", subject, "html", html)
	return nil
}

type resendSender struct {
	apiKey string
	from   string
	http   *http.Client
}

func (r *resendSender) Send(ctx context.Context, to, subject, html string) error {
	body, err := json.Marshal(map[string]any{
		"from":    r.from,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	})
	if err != nil {
		return fmt.Errorf("encode email: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, resendEndpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build email request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+r.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := r.http.Do(req)
	if err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		// Cap the read: a provider erroring with an HTML page shouldn't end up
		// in the log in full.
		detail, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return fmt.Errorf("send email: provider returned %d: %s", resp.StatusCode, detail)
	}
	return nil
}
