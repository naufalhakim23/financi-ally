import { schemaMigrations, createTable } from "@nozbe/watermelondb/Schema/migrations";

// Without a migration for a bumped schema version, WatermelonDB throws on open
// and the local database (including unsynced offline writes) is unusable. Every
// schema.ts version bump needs a step here.
export default schemaMigrations({
  migrations: [
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
