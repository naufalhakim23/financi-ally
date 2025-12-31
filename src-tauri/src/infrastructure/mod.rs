// Infrastructure layer - External implementations (Adapters)
//
// This layer contains implementations of domain ports (interfaces):
// - Persistence: SQLite repository implementation
// - Encryption: SQLCipher integration (Phase 8)
// - ID Generation: UUID v7 generator

pub mod persistence;
pub mod id_generation;
pub mod encryption;
