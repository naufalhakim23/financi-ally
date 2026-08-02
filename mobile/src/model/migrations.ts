import { schemaMigrations, addColumns, createTable } from "@nozbe/watermelondb/Schema/migrations";

// Without a migration for a bumped schema version, WatermelonDB throws on open
// and the local database (including unsynced offline writes) is unusable. Every
// schema.ts version bump needs a step here.
export default schemaMigrations({
  migrations: [
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: "entries",
          columns: [{ name: "attachment_id", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: "entries",
          columns: [{ name: "fx_rate", type: "string", isOptional: true }],
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        createTable({
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
    },
  ],
});
