import { Database } from "@nozbe/watermelondb";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";

import schema from "../model/schema";
import { Account, Budget, Entry, JournalLine } from "../model/models";

// Single WatermelonDB instance. JSI SQLite adapter for native speed; this is
// why the app needs a development build (expo-dev-client) rather than Expo Go —
// the native module isn't in the Go runtime.
const adapter = new SQLiteAdapter({
  schema,
  jsi: true,
  dbName: "financially",
});

export const database = new Database({
  adapter,
  modelClasses: [Account, Entry, JournalLine, Budget],
});
