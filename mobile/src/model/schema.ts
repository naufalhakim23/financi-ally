import { appSchema, tableSchema } from "@nozbe/watermelondb";

// App-field columns only — matches what /sync/pull returns. created_at/updated_at
// are WatermelonDB-managed and never declared. Timestamps from the server
// (txn_date, period_month) arrive as ms epoch and are stored as numbers.
export default appSchema({
  version: 4,
  tables: [
    tableSchema({
      name: "accounts",
      columns: [
        { name: "type", type: "string" },
        { name: "currency", type: "string" },
        { name: "name", type: "string", isOptional: true },
        { name: "parent_id", type: "string", isOptional: true },
        { name: "archived", type: "boolean" },
      ],
    }),
    tableSchema({
      name: "entries",
      columns: [
        { name: "txn_date", type: "number" },
        { name: "status", type: "string" },
        { name: "currency", type: "string" },
        // Cross-currency rate (M4). /sync/pull has always sent it; without the
        // column WatermelonDB drops it, so a converted entry read back from the
        // local database lost the rate it was converted at.
        { name: "fx_rate", type: "string", isOptional: true },
        { name: "source", type: "string" },
        { name: "memo", type: "string", isOptional: true },
        // Set locally by a receipt scan and carried out on the next push, which
        // is when the server can file the photo against the posted entry. /sync/pull
        // never sends it back — by then the link already exists server-side, so
        // this column is write-only and transient by design.
        { name: "attachment_id", type: "string", isOptional: true },
      ],
    }),
    tableSchema({
      name: "journal_lines",
      columns: [
        { name: "entry_id", type: "string", isIndexed: true },
        { name: "account_id", type: "string", isIndexed: true },
        { name: "dc", type: "string" },
        { name: "amount_minor", type: "number" },
        { name: "currency", type: "string" },
      ],
    }),
    tableSchema({
      name: "budgets",
      columns: [
        { name: "account_id", type: "string", isIndexed: true },
        { name: "period_month", type: "number" },
        { name: "target_minor", type: "number" },
        { name: "currency", type: "string" },
      ],
    }),
    // Recurring rules (M6). `template` holds the entry skeleton as a JSON
    // string — WatermelonDB columns are scalars, and the server sends it as
    // text for exactly that reason. next_run/last_run are server-owned:
    // scheduling happens on the server, the client only defines the rule.
    tableSchema({
      name: "recurring_rules",
      columns: [
        { name: "rrule", type: "string" },
        { name: "template", type: "string" },
        { name: "next_run", type: "number", isOptional: true },
        { name: "last_run", type: "number", isOptional: true },
        { name: "active", type: "boolean" },
      ],
    }),
  ],
});
