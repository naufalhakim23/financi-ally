// Re-export shim. The implementation lives in shared-context/domain/buckets.ts and
// is shared with the web client, so a money fix cannot land in one client only.
// Kept as a shim rather than rewriting ~30 import sites across app/.
export * from "@financially/domain/buckets";
