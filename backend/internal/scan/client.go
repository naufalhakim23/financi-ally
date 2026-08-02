package scan

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

type Config struct {
	APIKey string
	Model  string // defaults to Haiku 4.5
	Mock   bool   // force the fixed-draft extractor even when a key is present
}

// NewExtractor picks the extractor. No API key (or Mock set) yields the fixed
// one, so a missing key does not make the whole API un-runnable in local dev.
// config.Load refuses a production boot with no key and no explicit SCAN_MOCK.
func NewExtractor(cfg Config) Extractor {
	if cfg.Mock || cfg.APIKey == "" {
		slog.Warn("receipt scanning is mocked; a fixed draft is returned, no image is read")
		return mockExtractor{}
	}
	model := cfg.Model
	if model == "" {
		model = string(anthropic.ModelClaudeHaiku4_5)
	}
	return &claudeExtractor{
		client: anthropic.NewClient(option.WithAPIKey(cfg.APIKey)),
		model:  anthropic.Model(model),
	}
}

// Returns a fixed draft without reading the image, so the whole scan → review →
// post path is exercisable offline and in tests.
type mockExtractor struct{}

func (mockExtractor) Extract(_ context.Context, _ string, _ []byte, categories []CategoryOption) (*Extraction, error) {
	e := &Extraction{
		Merchant:   "Warung Mock",
		TxnDate:    "",
		Currency:   "IDR",
		Total:      "45000",
		Confidence: 0.9,
	}
	// First offered category, so the linking path is exercised too.
	if len(categories) > 0 {
		e.CategoryID = categories[0].ID
	}
	return e, nil
}

// One request: image in, schema-constrained JSON out. No OCR stage — layout is
// the signal that distinguishes a line item from the total.
type claudeExtractor struct {
	client anthropic.Client
	model  anthropic.Model
}

const extractSystemPrompt = `You read photographed receipts and return the fields needed to record one expense.

Rules:
- "total" is the final amount actually paid, after discounts and including tax — never a line item, never a subtotal.
- "total" is a plain decimal string using "." for the decimal point and no thousands separators or currency symbols. Indonesian receipts often print "45.000" or "Rp45.000,-" meaning forty-five thousand rupiah: return "45000".
- "currency" is an ISO 4217 code. Infer it from symbols, language, or address when it is not printed. Leave it empty if you genuinely cannot tell.
- "txn_date" is YYYY-MM-DD. Receipts print many date formats and some print none; leave it empty rather than guessing.
- "category_id" must be one of the ids listed in the user message, chosen by what was bought. If none fits, or you are unsure, return an empty string.
- "confidence" is 0 to 1: how sure you are of the total and currency specifically. A blurry, cropped, or non-receipt image should score low.

Return empty strings for fields you cannot read. Do not invent values.`

// Structured outputs reject numeric and length constraints, so confidence
// bounds are checked in the service.
var extractionSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"merchant":    map[string]any{"type": "string"},
		"txn_date":    map[string]any{"type": "string"},
		"currency":    map[string]any{"type": "string"},
		"total":       map[string]any{"type": "string"},
		"category_id": map[string]any{"type": "string"},
		"confidence":  map[string]any{"type": "number"},
	},
	"required":             []string{"merchant", "txn_date", "currency", "total", "category_id", "confidence"},
	"additionalProperties": false,
}

func (c *claudeExtractor) Extract(ctx context.Context, mime string, image []byte, categories []CategoryOption) (*Extraction, error) {
	msg, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.model,
		MaxTokens: 1024,
		System:    []anthropic.TextBlockParam{{Text: extractSystemPrompt}},
		OutputConfig: anthropic.OutputConfigParam{
			Format: anthropic.JSONOutputFormatParam{Schema: extractionSchema},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewImageBlockBase64(mime, base64.StdEncoding.EncodeToString(image)),
				anthropic.NewTextBlock(categoryPrompt(categories)),
			),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("extract receipt: %w", err)
	}
	// A refused or truncated response has no usable JSON. Truncation is the
	// realistic one — a long itemised receipt can run past MaxTokens — and must
	// surface as "unreadable photo", not a 500 the user cannot act on.
	if msg.StopReason == anthropic.StopReasonRefusal || msg.StopReason == anthropic.StopReasonMaxTokens {
		return nil, ErrUnreadable
	}

	var raw string
	for _, block := range msg.Content {
		if text, ok := block.AsAny().(anthropic.TextBlock); ok {
			raw = text.Text
			break
		}
	}
	if raw == "" {
		return nil, ErrUnreadable
	}

	var e Extraction
	if err := json.Unmarshal([]byte(raw), &e); err != nil {
		return nil, fmt.Errorf("extract receipt: decode: %w", err)
	}
	return &e, nil
}

// Offering the ledger's real ids is what stops the model returning a category
// this book does not have.
func categoryPrompt(categories []CategoryOption) string {
	if len(categories) == 0 {
		return "This ledger has no expense categories. Return an empty category_id."
	}
	var b strings.Builder
	b.WriteString("Choose category_id from exactly these, or return an empty string:\n")
	for _, c := range categories {
		fmt.Fprintf(&b, "- %s: %s\n", c.ID, c.Name)
	}
	return b.String()
}
