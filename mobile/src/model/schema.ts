import { appSchema, tableSchema } from "@nozbe/watermelondb";

// App-field columns only — matches what /sync/pull returns. created_at/updated_at
// are WatermelonDB-managed and never declared. Timestamps from the server
// (txn_date, period_month) arrive as ms epoch and are stored as numbers.
export default appSchema({
  version: 1,
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
        { name: "source", type: "string" },
        { name: "memo", type: "string", isOptional: true },
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
  ],
});
