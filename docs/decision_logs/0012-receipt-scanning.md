# 0012 — Receipt scanning (M10)

**Status**: implemented; verified against a live database, unverified on device
**Date**: 2026-08-02

## Context

Typing an entry after every purchase is the main friction in daily use. A photo
of the receipt carries everything an entry needs — amount, date, merchant, and
enough context to guess the category.

## Decisions

### Vision model, not OCR

The starting proposal was Baidu's unlimited OCR. Rejected: OCR returns *text*,
and an entry needs *fields*, so a second parsing stage would still be required —
two vendors, two failure modes. Worse, OCR discards layout, which is precisely
the signal separating a line item from the total.

A vision model does it in one hop, handles Indonesian receipts and thermal-paper
noise, and costs roughly $0.003 per receipt on Haiku 4.5. The OCR path saves that
$0.003 and buys a parser to maintain forever.

Revisit if on-device/offline extraction or a China data-residency requirement
ever appears — those are the cases OCR wins.

**Model**: `claude-haiku-4-5`. Extraction from an image is a well-scoped task.
Note it does *not* support `output_config.effort` (that errors on Haiku), so the
request sets only a JSON schema. Escalate to Sonnet only if measured accuracy
falls short.

### The AI never posts

`ledger.Post` remains the single money entrypoint. The scan service has no
reference to it and cannot reach it. A scan produces a `Draft` — a proposal that
has never touched the journal — the client prefills the ordinary entry screen,
and the human confirms. The confirmed entry is validated exactly as a typed one.

Two consequences worth stating:

- A category proposal below 0.6 confidence is **discarded**. A confidently wrong
  category invites a thoughtless confirm; an empty one makes the user choose.
- The model may only return category ids the ledger actually offered, which are
  passed into the prompt. It cannot invent a category this book does not have.

### Blobs in Postgres, behind an interface

No object storage existed in the project. At this scale — a household's receipts,
a few hundred a year at ~150KB — that is tens of megabytes, which Postgres stores
out of line via TOAST. Adding S3/R2 now would buy durability the product does not
need and cost a dependency, a credential, a presign flow, and a second thing that
can be down.

Boss asked for the swap to stay open, so bytes sit behind `scan.BlobStore` and in
their own `attachment_blobs` table, which nothing outside `blobstore.go` reads.
Metadata (`entry_attachments`) stays in Postgres always — it is tenancy-scoped and
indexed. Swapping to S3, R2, or a VPS volume means writing one implementation and
dropping one table; no query the app actually runs changes.

The ceiling: backup weight and single-node disk. That is the trigger to swap.

### Images are not synced

WatermelonDB pull/push carries JSON. Replicating binaries through it would mean
reworking M3 for no gain, so the client fetches an image on demand from
`GET /entries/{id}/attachment` when the user opens an entry.

### Linking rides the sync push, not the REST path

The mobile app writes entries locally and syncs them; it never calls
`POST /entries`. So a scanned photo is filed against its entry in
`sync.pushEntry`, after `ledger.Post` succeeds — that is the first moment the
entry exists server-side. `attachment_id` on `POST /entries` exists for REST
parity but is not the mobile path.

Linking failures are **logged, not returned**, in both paths. The entry is already
posted and immutable; surfacing an error would make the client resend a record
that can only fail as a duplicate. The cost of a failed link is one entry without
its photo, and the image is reaped on schedule.

`clientSource` whitelists what a pushed record may claim: `manual` and
`receipt_scan` only. `recurring` and `import` are server-owned provenance and a
client must not be able to dress a record up as scheduler output.

### Staged uploads and the reaper

The photo is uploaded when the scan runs, which is before the human has confirmed
anything, so `entry_attachments.entry_id` is nullable and abandoned scans
accumulate. A sweeper deletes unlinked rows older than `SCAN_REAP_AFTER` (24h).

It runs on its own ticker rather than riding the recurring scheduler: the two have
no relationship, and `RECURRING_ENABLED=false` must not silently stop collecting
garbage. Rows are deleted before blobs — a crash between the two leaks bytes
nothing references (invisible waste), where the reverse order would leave a row
pointing at bytes that no longer exist (a broken read).

### Keyless by default

`NewExtractor` returns a fixed-draft extractor when `ANTHROPIC_API_KEY` is empty,
mirroring `internal/mail`. Local development and tests run without a key.
`config.Load` refuses a production boot with no key unless `SCAN_MOCK=true` — the
mock returns the *same* fabricated 45,000 IDR draft for every photo, and shipping
that unnoticed would have users confirming invented expenses.

### Per-user daily cap in Postgres, not in memory (post-review)

`/scan/receipt` is the only endpoint whose cost is paid per call to a third
party, and nothing bounded it: one authenticated client in a loop drained the
Anthropic budget for everyone.

The cap lives in `scan_usage (user_id, day, count)` and is claimed by a single
upsert-returning statement, so two concurrent scans cannot both read the same
count and both pass — the row lock serializes them. An in-memory token bucket was
the smaller diff and was rejected: it resets on every deploy and multiplies by
replica count, which makes the number in the config a fiction.

Counted per **UTC day** rather than the user's local day. This is a spend guard,
not a user-facing quota, and a per-user calendar would need a stored timezone
this table has no business owning.

Claimed **before** the model call, so a failed extraction still spends a unit.
That is the intended direction: a call that reached the API was paid for whether
or not it produced a usable draft. Rejected images are refused before the claim
and cost nothing.

### Scan gets its own request deadline

The global `middleware.Timeout(30s)` also wrapped scan, and the mobile client
aborted at 30s too — an 8 MiB upload over mobile data plus a vision call can
exceed that, and both ends gave up at the same instant, after the model call was
already paid for. Scan now gets 90s server-side (`routeTimeout` in `main.go`);
everything else keeps the tight 30s. The client sits at 95s so the server's
answer wins the race and the user sees the real reason instead of a network
error.

### One whitelist for entry provenance, both doors

`sync` refused to let a pushed record claim `recurring`/`import`; the REST
`POST /entries` path passed `source` straight through. The guard moved to
`ledger.ClientSource` and both callers use it — a threat model with two doors
needs one lock, not two implementations that can drift.

## Verified

- `go build`, `go vet`, `go test ./...` clean.
- `internal/scan`: unit tests over `toDraft` — the money path. Minor-unit
  conversion per currency exponent (IDR 45000 → 45000; USD 12.34 → 1234),
  currency fallback, rejection of unusable totals, the confidence gate, rejection
  of categories the ledger never offered, and rune-safe truncation.
- `internal/handler`: the spec validator was the one live architectural risk —
  it reads and re-serves every request body, and the generated handler calls
  `r.MultipartReader()`, which fails outright if anything upstream form-parsed
  the body first. A test runs a real multipart request through the real
  middleware and asserts the bytes arrive intact. They do.

- **Live database (post-review)**: migrations 011 and 012 applied to the local
  Postgres on 5433; 012 also survives a `down 1` / `up` round trip. The orphan
  sweep was exercised in a transaction — an old unreferenced blob is collected, a
  young one is not (the `Scan` write window), and a blob whose row was cascaded
  away by a ledger delete becomes collectable. The usage sweep drops past days
  and leaves today.
- **Live cap (post-review)**: with `SCAN_DAILY_LIMIT=2`, three calls returned
  200, 200, then `429 quota_exceeded`, and `scan_usage.count` read 3.
- **Live provenance guard (post-review)**: `POST /entries` with
  `"source":"recurring"` came back `manual`; `"receipt_scan"` passed through.

## Not verified

- **Extraction accuracy on real receipts is untested** — no API key was exercised.
  The mock path is what ran.
- **The mobile camera flow is unverified.** Needs a dev build; `launchCameraAsync`
  does not work in a simulator.
