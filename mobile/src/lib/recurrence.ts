// Re-export shim. The implementation lives in shared-context/domain/recurrence.ts
// and is shared with the web client, so a rule authored on one client reads back
// identically on the other.
export * from "@financially/domain/recurrence";
