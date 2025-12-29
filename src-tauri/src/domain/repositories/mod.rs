// Repository Traits (Ports): Interfaces for persistence
// These are defined in the domain layer but implemented in the infrastructure layer
// This is the key to Hexagonal Architecture - domain defines what it needs, infrastructure provides it

pub mod transaction_repository;

pub use transaction_repository::{TransactionRepository, RepositoryError};
